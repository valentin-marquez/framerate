import type { RatingStats, ReviewItem, ReviewSort, StoreDetail, StoreRole } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { sql } from "kysely";
import { avatarUrl } from "@/features/identity/domain/avatar";

const RECENT_DAYS = 30;

const average = (sum: number, count: number) => (count > 0 ? Math.round((sum / count) * 10) / 10 : null);

export async function findStore(db: Db, slug: string) {
  return db.query
    .selectFrom("stores as s")
    .leftJoin("store_profiles as p", "p.store_id", "s.id")
    .select([
      "s.id",
      "s.slug",
      "s.name",
      "s.url",
      "s.is_active",
      "s.scraped_icon_url",
      "s.organization_id",
      "s.verified_at",
      "s.frozen_at",
      "s.rating_count",
      "s.rating_sum",
      "s.created_at",
      "p.display_name",
      "p.description",
      "p.website_url",
      "p.social",
      sql<number>`(SELECT count(*) FROM listings l WHERE l.store_id = s.id AND l.is_active = 1)`.as("offer_count"),
    ])
    .where("s.slug", "=", slug)
    .executeTakeFirst();
}
export type StoreRow = NonNullable<Awaited<ReturnType<typeof findStore>>>;

async function recentRating(db: Db, storeId: number, now: string) {
  const since = new Date(Date.parse(now) - RECENT_DAYS * 86_400_000).toISOString();
  const row = await db.query
    .selectFrom("store_reviews")
    .select([sql<number>`count(*)`.as("count"), sql<number>`coalesce(sum(rating), 0)`.as("sum")])
    .where("store_id", "=", storeId)
    .where("deleted_at", "is", null)
    .where("created_at", ">=", since)
    .executeTakeFirstOrThrow();
  return { average: average(Number(row.sum), Number(row.count)), count: Number(row.count) };
}

export async function storeDetail(db: Db, store: StoreRow, now: string): Promise<StoreDetail> {
  return {
    slug: store.slug,
    name: store.display_name ?? store.name,
    canonicalName: store.name,
    displayName: store.display_name,
    url: store.url,
    website: store.website_url,
    description: store.description,
    social: store.social ? JSON.parse(store.social) : {},
    iconUrl: store.scraped_icon_url,
    bannerUrl: null,
    isActive: !!store.is_active,
    isClaimed: store.organization_id !== null,
    verifiedAt: store.verified_at,
    frozen: store.frozen_at !== null,
    createdAt: store.created_at,
    offerCount: Number(store.offer_count),
    rating: {
      average: average(store.rating_sum, store.rating_count),
      count: store.rating_count,
      recent: await recentRating(db, store.id, now),
    },
  };
}

/** Rol del usuario en la organización dueña de la tienda; null si no es miembro o la tienda no está reclamada. */
export async function storeRole(db: Db, store: { organization_id: number | null }, userId: string) {
  if (store.organization_id === null) return null;
  const row = await db.query
    .selectFrom("organization_members")
    .select("role")
    .where("organization_id", "=", store.organization_id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return (row?.role ?? null) as StoreRole | null;
}

// ─── Reseñas ─────────────────────────────────────────────────────────────────

export async function listReviews(
  db: Db,
  storeId: number,
  opts: { sort: ReviewSort; limit: number; offset: number; viewerId: string | null },
) {
  const { viewerId } = opts;
  let query = db.query
    .selectFrom("store_reviews as r")
    .leftJoin("users as u", (join) => join.onRef("u.id", "=", "r.user_id").on("u.deleted_at", "is", null))
    .select([
      "r.id",
      "r.user_id",
      "r.rating",
      "r.body",
      "r.helpful_count",
      "r.is_pinned",
      "r.owner_response",
      "r.owner_response_at",
      "r.edited_at",
      "r.deleted_at",
      "r.deletion_reason",
      "r.created_at",
      "u.username",
      "u.display_name",
      "u.avatar_key",
      "u.avatar_source_url",
      viewerId
        ? sql<number>`EXISTS (SELECT 1 FROM store_review_votes v WHERE v.review_id = r.id AND v.user_id = ${viewerId})`.as(
            "voted",
          )
        : sql<number>`0`.as("voted"),
    ])
    .where("r.store_id", "=", storeId)
    .orderBy("r.is_pinned", "desc");

  if (opts.sort === "helpful") query = query.orderBy("r.helpful_count", "desc");
  if (opts.sort === "rating_desc") query = query.orderBy("r.rating", "desc");
  const rows = await query
    .orderBy("r.created_at", "desc")
    .orderBy("r.id", "desc")
    .limit(opts.limit)
    .offset(opts.offset)
    .execute();

  const total = await db.query
    .selectFrom("store_reviews")
    .select(sql<number>`count(*)`.as("n"))
    .where("store_id", "=", storeId)
    .executeTakeFirstOrThrow();

  const items: ReviewItem[] = rows.map((r) =>
    r.deleted_at !== null
      ? {
          deleted: true,
          id: r.id,
          reason: r.deletion_reason ?? "author",
          isPinned: false,
          createdAt: r.created_at,
        }
      : {
          deleted: false,
          id: r.id,
          rating: r.rating,
          comment: r.body,
          helpfulCount: r.helpful_count,
          isPinned: !!r.is_pinned,
          ownerResponse: r.owner_response,
          ownerResponseAt: r.owner_response_at,
          editedAt: r.edited_at,
          createdAt: r.created_at,
          author: r.username
            ? { username: r.username, displayName: r.display_name ?? r.username, avatarUrl: avatarUrl(r) }
            : null,
          mine: viewerId !== null && r.user_id === viewerId,
          votedByMe: !!r.voted,
        },
  );
  return { items, total: Number(total.n) };
}

export async function ratingStats(db: Db, storeId: number): Promise<RatingStats> {
  const rows = await db.query
    .selectFrom("store_reviews")
    .select(["rating", sql<number>`count(*)`.as("n")])
    .where("store_id", "=", storeId)
    .where("deleted_at", "is", null)
    .groupBy("rating")
    .execute();
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const r of rows) {
    distribution[r.rating as 1 | 2 | 3 | 4 | 5] = Number(r.n);
    total += Number(r.n);
    sum += r.rating * Number(r.n);
  }
  return { average: average(sum, total), total, distribution };
}

export const findReview = (db: Db, id: number) =>
  db.query
    .selectFrom("store_reviews as r")
    .innerJoin("stores as s", "s.id", "r.store_id")
    .select([
      "r.id",
      "r.store_id",
      "r.user_id",
      "r.deleted_at",
      "r.is_pinned",
      "s.slug as store_slug",
      "s.organization_id",
      "s.frozen_at",
    ])
    .where("r.id", "=", id)
    .executeTakeFirst();
export type ReviewRow = NonNullable<Awaited<ReturnType<typeof findReview>>>;

export const findActiveReviewId = (db: Db, storeId: number, userId: string) =>
  db.query
    .selectFrom("store_reviews")
    .select("id")
    .where("store_id", "=", storeId)
    .where("user_id", "=", userId)
    .where("deleted_at", "is", null)
    .executeTakeFirst();

export async function insertReview(
  db: Db,
  review: { storeId: number; userId: string; rating: number; comment: string | null; now: string },
) {
  const row = await db.query
    .insertInto("store_reviews")
    .values({
      store_id: review.storeId,
      user_id: review.userId,
      rating: review.rating,
      body: review.comment,
      created_at: review.now,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

export async function editReviewContent(
  db: Db,
  id: number,
  patch: { rating?: number; comment?: string | null; now: string },
) {
  await db.query
    .updateTable("store_reviews")
    .set({
      ...(patch.rating !== undefined && { rating: patch.rating }),
      ...(patch.comment !== undefined && { body: patch.comment }),
      edited_at: patch.now,
    })
    .where("id", "=", id)
    .execute();
}

/** Responder y fijar sólo lo decide la organización dueña. Fijar deja una sola reseña fijada por tienda. */
export async function manageReview(
  db: Db,
  review: ReviewRow,
  patch: { ownerResponse?: string | null; isPinned?: boolean; actorId: string | null; now: string },
) {
  const writes = [];
  if (patch.isPinned === true) {
    writes.push(
      db.query
        .updateTable("store_reviews")
        .set({ is_pinned: 0 })
        .where("store_id", "=", review.store_id)
        .where("is_pinned", "=", 1),
    );
  }
  writes.push(
    db.query
      .updateTable("store_reviews")
      .set({
        ...(patch.isPinned !== undefined && { is_pinned: patch.isPinned ? 1 : 0 }),
        ...(patch.ownerResponse !== undefined && {
          owner_response: patch.ownerResponse,
          owner_response_at: patch.ownerResponse === null ? null : patch.now,
          owner_response_by: patch.ownerResponse === null ? null : patch.actorId,
        }),
      })
      .where("id", "=", review.id),
  );
  await db.batch(writes);
}

export async function softDeleteReview(
  db: Db,
  id: number,
  by: { userId: string; reason: "author" | "moderation"; now: string },
) {
  await db.query
    .updateTable("store_reviews")
    .set({ deleted_at: by.now, deleted_by: by.userId, deletion_reason: by.reason, is_pinned: 0 })
    .where("id", "=", id)
    .where("deleted_at", "is", null)
    .execute();
}

export async function setVote(db: Db, reviewId: number, userId: string, voted: boolean, now: string) {
  if (voted) {
    await db.query
      .insertInto("store_review_votes")
      .values({ review_id: reviewId, user_id: userId, created_at: now })
      .onConflict((oc) => oc.doNothing())
      .execute();
  } else {
    await db.query
      .deleteFrom("store_review_votes")
      .where("review_id", "=", reviewId)
      .where("user_id", "=", userId)
      .execute();
  }
}

export async function storeCategoryCounts(db: Db, storeId: number) {
  const rows = await db.query
    .selectFrom("listings")
    .select(["category", sql<number>`count(distinct product_id)`.as("n")])
    .where("store_id", "=", storeId)
    .where("is_active", "=", 1)
    .where("product_id", "is not", null)
    .groupBy("category")
    .orderBy("n", "desc")
    .execute();
  return rows.map((r) => ({ category: r.category, count: Number(r.n) }));
}
