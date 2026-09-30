import {
  type Category,
  CreateReviewRequestSchema,
  DeleteReviewRequestSchema,
  hasRole,
  ReviewSortSchema,
  UpdateReviewRequestSchema,
} from "@framerate/contracts";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { listProducts } from "@/features/catalog/catalog.queries";
import { currentUser, optionalUser, requireUser } from "@/features/identity/middleware";
import { assertNotBanned } from "@/features/identity/policies";
import { recordModerationAction } from "@/shared/audit";
import { AppError } from "@/shared/http/errors";
import {
  editReviewContent,
  findActiveReviewId,
  findReview,
  findStore,
  insertReview,
  listReviews,
  manageReview,
  type ReviewRow,
  ratingStats,
  setVote,
  softDeleteReview,
  storeCategoryCounts,
  storeDetail,
  storeRole,
} from "./stores.repository";

/**
 * Tiendas y reseñas. La lectura es pública (con el visitante opcional para "mi voto" y "mi reseña");
 * escribir exige sesión sin sanción. Responder y fijar es de la organización dueña; eliminar, del autor o del personal.
 */

async function requireStore(c: Context<AppEnv>) {
  const store = await findStore(c.var.db, c.req.param("slug") ?? "");
  if (!store) throw new AppError(404, "store_not_found", "Tienda no encontrada");
  return store;
}

async function requireReview(c: Context<AppEnv>) {
  const id = z.coerce.number().int().positive().safeParse(c.req.param("id"));
  const review = id.success ? await findReview(c.var.db, id.data) : undefined;
  if (!review) throw new AppError(404, "review_not_found", "Reseña no encontrada");
  return review;
}

const ownerCanManage = (review: ReviewRow, role: string | null, staff: boolean) =>
  staff || (role !== null && review.frozen_at === null);

export const storesRoutes = new Hono<AppEnv>()
  .get("/stores/:slug", optionalUser, async (c) => {
    const store = await requireStore(c);
    return c.json(await storeDetail(c.var.db, store, new Date().toISOString()));
  })

  .get("/stores/:slug/products", async (c) => {
    const store = await requireStore(c);
    const counts = await storeCategoryCounts(c.var.db, store.id);
    const categories = await Promise.all(
      counts.map(async ({ category, count }) => {
        const page = await listProducts(c.var.db, {
          category: category as Category,
          store: store.slug,
          sort: "popularity",
          page: 1,
          pageSize: 12,
        });
        return { category: category as Category, count, items: page.items };
      }),
    );
    return c.json({ total: categories.reduce((sum, cat) => sum + cat.count, 0), categories });
  })

  .get("/stores/:slug/me", requireUser, async (c) => {
    const store = await requireStore(c);
    return c.json({ role: await storeRole(c.var.db, store, currentUser(c).id) });
  })

  .get("/stores/:slug/reviews", optionalUser, async (c) => {
    const store = await requireStore(c);
    const query = z
      .object({
        sort: ReviewSortSchema.default("recent"),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(c.req.query());
    const { items, total } = await listReviews(c.var.db, store.id, { ...query, viewerId: c.var.user?.id ?? null });
    return c.json({ items, total, limit: query.limit, offset: query.offset, sort: query.sort });
  })

  .get("/stores/:slug/reviews/stats", async (c) => {
    const store = await requireStore(c);
    return c.json(await ratingStats(c.var.db, store.id));
  })

  .post("/stores/:slug/reviews", requireUser, async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const store = await requireStore(c);
    const body = CreateReviewRequestSchema.parse(await c.req.json().catch(() => ({})));

    if (await storeRole(c.var.db, store, user.id)) {
      throw new AppError(403, "own_store", "No puedes reseñar una tienda que administras");
    }
    if (await findActiveReviewId(c.var.db, store.id, user.id)) {
      throw new AppError(409, "already_reviewed", "Ya reseñaste esta tienda");
    }
    const id = await insertReview(c.var.db, {
      storeId: store.id,
      userId: user.id,
      rating: body.rating,
      comment: body.comment ?? null,
      now: new Date().toISOString(),
    }).catch((error: Error) => {
      if (error.message.includes("UNIQUE")) throw new AppError(409, "already_reviewed", "Ya reseñaste esta tienda");
      throw error;
    });
    return c.json({ id }, 201);
  })

  .patch("/reviews/:id", requireUser, async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const review = await requireReview(c);
    if (review.deleted_at !== null) throw new AppError(404, "review_not_found", "Reseña no encontrada");
    const body = UpdateReviewRequestSchema.parse(await c.req.json().catch(() => ({})));
    const now = new Date().toISOString();

    const edits = body.rating !== undefined || body.comment !== undefined;
    const manages = body.ownerResponse !== undefined || body.isPinned !== undefined;

    if (edits) {
      if (review.user_id !== user.id) throw new AppError(403, "forbidden", "Sólo el autor puede editar su reseña");
      await editReviewContent(c.var.db, review.id, { rating: body.rating, comment: body.comment, now });
    }
    if (manages) {
      const role = await storeRole(c.var.db, review, user.id);
      if (!ownerCanManage(review, role, hasRole(user.role, "admin"))) {
        throw new AppError(403, "forbidden", "Sólo la organización dueña puede responder o fijar reseñas");
      }
      await manageReview(c.var.db, review, {
        ownerResponse: body.ownerResponse,
        isPinned: body.isPinned,
        actorId: user.id,
        now,
      });
    }
    return c.body(null, 204);
  })

  .delete("/reviews/:id", requireUser, async (c) => {
    const user = currentUser(c);
    const review = await requireReview(c);
    if (review.deleted_at !== null) throw new AppError(404, "review_not_found", "Reseña no encontrada");
    const body = DeleteReviewRequestSchema.parse(await c.req.json().catch(() => ({})));
    const now = new Date().toISOString();

    if (review.user_id === user.id) {
      await softDeleteReview(c.var.db, review.id, { userId: user.id, reason: "author", now });
    } else if (hasRole(user.role, "moderator")) {
      await softDeleteReview(c.var.db, review.id, { userId: user.id, reason: "moderation", now });
      await recordModerationAction(c.var.db, {
        actorId: user.id,
        action: "review_removed",
        targetType: "store_review",
        targetId: String(review.id),
        reason: body.reason ?? null,
        now,
      });
    } else {
      throw new AppError(403, "forbidden", "No puedes eliminar esta reseña");
    }
    return c.body(null, 204);
  })

  .put("/reviews/:id/helpful", requireUser, async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const review = await requireReview(c);
    if (review.deleted_at !== null) throw new AppError(404, "review_not_found", "Reseña no encontrada");
    if (review.user_id === user.id) throw new AppError(403, "own_review", "No puedes votar tu propia reseña");
    await setVote(c.var.db, review.id, user.id, true, new Date().toISOString());
    return c.body(null, 204);
  })

  .delete("/reviews/:id/helpful", requireUser, async (c) => {
    const review = await requireReview(c);
    await setVote(c.var.db, review.id, currentUser(c).id, false, new Date().toISOString());
    return c.body(null, 204);
  });
