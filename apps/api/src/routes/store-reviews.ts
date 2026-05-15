/**
 * @module routes/store-reviews
 *
 * Fase 2: Endpoints CRUD para reseñas de tiendas + votos "útil" + respuesta del dueño.
 * Trust boundary: web -> api (anon + JWT) -> Supabase. RLS valida; el endpoint
 * además limita qué columnas se actualizan según el rol del usuario.
 *
 * Exporta dos sub-apps:
 *   - `storeReviewsByStore`  -> /v1/stores/:slug/reviews*
 *   - `storeReviewsById`     -> /v1/reviews/:id*
 */

import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";
import { CACHE_TTL, Cache, invalidateCache } from "@/middleware/cache";

const MAX_COMMENT_LENGTH = 2000;
const MAX_OWNER_RESPONSE_LENGTH = 1000;

type SortMode = "recent" | "helpful" | "rating-desc";

function parseSort(value: string | undefined): SortMode {
  if (value === "helpful" || value === "rating-desc") return value;
  return "recent";
}

async function resolveStoreIdBySlug(supabase: ReturnType<typeof createSupabase>, slug: string) {
  const { data, error } = await supabase.from("stores").select("id").eq("slug", slug).single();
  if (error || !data) return null;
  return data.id as string;
}

// ===================================================================================
// Sub-app 1: rutas por store slug (/v1/stores/:slug/reviews*)
// ===================================================================================

export const storeReviewsByStore = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * GET /v1/stores/:slug/reviews
 *
 * Lista paginada de reseñas. Excluye soft-deleted del payload de detalle pero
 * deja un placeholder `{ deleted: true, deleted_reason }` para preservar orden.
 *
 * Query params:
 *   - sort: recent | helpful | rating-desc (default: recent)
 *   - limit: 1-100 (default 20)
 *   - offset: >=0 (default 0)
 */
storeReviewsByStore.get(
  "/:slug/reviews",
  Cache({ mode: "public", ttl: CACHE_TTL.SHORT, name: "store-reviews-list" }),
  async (c) => {
    const slug = c.req.param("slug");
    const sort = parseSort(c.req.query("sort"));
    const limit = Math.min(Math.max(Number.parseInt(c.req.query("limit") ?? "20", 10) || 20, 1), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") ?? "0", 10) || 0, 0);

    const supabase = createSupabase(c.env);
    const storeId = await resolveStoreIdBySlug(supabase, slug);
    if (!storeId) {
      return c.json({ error: "Store not found" }, 404);
    }

    let query = supabase
      .from("store_reviews")
      .select(
        `
        id,
        store_id,
        user_id,
        rating,
        comment,
        helpful_count,
        is_pinned,
        owner_response,
        owner_response_at,
        owner_response_by,
        deleted_at,
        deleted_reason,
        created_at,
        updated_at,
        author:profiles!store_reviews_user_id_fkey(id, username, full_name, avatar_url)
        `,
        { count: "exact" },
      )
      .eq("store_id", storeId);

    // Pinned siempre arriba
    query = query.order("is_pinned", { ascending: false });

    if (sort === "helpful") {
      query = query.order("helpful_count", { ascending: false }).order("created_at", { ascending: false });
    } else if (sort === "rating-desc") {
      query = query.order("rating", { ascending: false }).order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error("Error listing store reviews:", error);
      return c.json({ error: "Failed to list reviews" }, 500);
    }

    const reviews = (data ?? []).map((r) => {
      if (r.deleted_at) {
        return {
          id: r.id,
          deleted: true,
          deleted_reason: r.deleted_reason,
          created_at: r.created_at,
          is_pinned: r.is_pinned,
        };
      }
      return { ...r, deleted: false };
    });

    return c.json({
      data: reviews,
      meta: {
        limit,
        offset,
        total: count ?? reviews.length,
        sort,
      },
    });
  },
);

/**
 * GET /v1/stores/:slug/reviews/stats
 *
 * Estadísticas agregadas: avg_rating, total_reviews, distribution.
 */
storeReviewsByStore.get(
  "/:slug/reviews/stats",
  Cache({ mode: "public", ttl: CACHE_TTL.SHORT, name: "store-reviews-stats" }),
  async (c) => {
    const slug = c.req.param("slug");
    const supabase = createSupabase(c.env);

    const { data, error } = await supabase.rpc("get_store_rating_stats", { p_store_slug: slug });
    if (error) {
      console.error("Error fetching store rating stats:", error);
      return c.json({ error: "Failed to fetch stats" }, 500);
    }
    // RPC retorna Json; lo casteamos a unknown para evitar inferencia profunda de Hono
    return c.json((data as unknown) ?? null);
  },
);

/**
 * POST /v1/stores/:slug/reviews
 *
 * Crea una reseña. Requiere auth. Un usuario solo puede tener una review activa
 * por store.
 */
storeReviewsByStore.post("/:slug/reviews", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const user = c.get("user");

  let body: { rating?: number; comment?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return c.json({ error: "Rating must be an integer between 1 and 5" }, 400);
  }

  const comment = body.comment?.trim() || null;
  if (comment && comment.length > MAX_COMMENT_LENGTH) {
    return c.json({ error: `Comment exceeds ${MAX_COMMENT_LENGTH} characters` }, 400);
  }

  const supabase = createSupabase(c.env, c.get("token"));
  const storeId = await resolveStoreIdBySlug(supabase, slug);
  if (!storeId) {
    return c.json({ error: "Store not found" }, 404);
  }

  // Verificar que el user no tenga ya una review activa
  const { data: existing } = await supabase
    .from("store_reviews")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return c.json({ error: "You already have an active review for this store", review_id: existing.id }, 409);
  }

  const { data, error } = await supabase
    .from("store_reviews")
    .insert({
      store_id: storeId,
      user_id: user.id,
      rating,
      comment,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating store review:", error);
    return c.json({ error: "Failed to create review" }, 500);
  }

  await invalidateCache(c, `/v1/stores/${slug}/reviews`, { name: "store-reviews-list" });
  await invalidateCache(c, `/v1/stores/${slug}/reviews/stats`, { name: "store-reviews-stats" });

  return c.json(data, 201);
});

// ===================================================================================
// Sub-app 2: rutas por review id (/v1/reviews/:id*)
// ===================================================================================

export const storeReviewsById = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * PATCH /v1/reviews/:id
 *
 * - Si sos el autor: podés editar `rating` y `comment`.
 * - Si sos store member (editor/owner) o admin: podés editar `owner_response`,
 *   `owner_response_at`, `owner_response_by`, `is_pinned`.
 *
 * No se permite mezclar ambos sets en un mismo request.
 */
storeReviewsById.patch("/:id", authMiddleware, async (c) => {
  const reviewId = c.req.param("id");
  const user = c.get("user");
  const role = c.get("userRole") ?? "user";

  let body: {
    rating?: number;
    comment?: string | null;
    owner_response?: string | null;
    is_pinned?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createSupabase(c.env, c.get("token"));

  const { data: review, error: fetchErr } = await supabase
    .from("store_reviews")
    .select("id, store_id, user_id, stores:stores!store_reviews_store_id_fkey(slug)")
    .eq("id", reviewId)
    .single();

  if (fetchErr || !review) {
    return c.json({ error: "Review not found" }, 404);
  }

  const isAuthor = review.user_id === user.id;
  const wantsAuthorFields = body.rating !== undefined || body.comment !== undefined;
  const wantsOwnerFields = body.owner_response !== undefined || body.is_pinned !== undefined;

  if (wantsAuthorFields && wantsOwnerFields) {
    return c.json({ error: "Cannot update author and owner fields in the same request" }, 400);
  }
  if (!wantsAuthorFields && !wantsOwnerFields) {
    return c.json({ error: "Nothing to update" }, 400);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (wantsAuthorFields) {
    if (!isAuthor) {
      return c.json({ error: "Only the author can edit rating or comment" }, 403);
    }
    if (body.rating !== undefined) {
      const r = Number(body.rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return c.json({ error: "Rating must be an integer between 1 and 5" }, 400);
      }
      updates.rating = r;
    }
    if (body.comment !== undefined) {
      const c2 = body.comment === null ? null : String(body.comment).trim() || null;
      if (c2 && c2.length > MAX_COMMENT_LENGTH) {
        return c.json({ error: `Comment exceeds ${MAX_COMMENT_LENGTH} characters` }, 400);
      }
      updates.comment = c2;
    }
  } else {
    // Owner fields: admin o is_store_member(store_id, 'editor')
    let allowed = role === "admin";
    if (!allowed) {
      const { data: memberCheck } = await supabase.rpc("is_store_member", {
        p_store_id: review.store_id,
        p_required_role: "editor",
      });
      allowed = memberCheck === true;
    }
    if (!allowed) {
      return c.json({ error: "Not allowed to update owner fields" }, 403);
    }
    if (body.owner_response !== undefined) {
      const resp = body.owner_response === null ? null : String(body.owner_response).trim() || null;
      if (resp && resp.length > MAX_OWNER_RESPONSE_LENGTH) {
        return c.json({ error: `Owner response exceeds ${MAX_OWNER_RESPONSE_LENGTH} characters` }, 400);
      }
      updates.owner_response = resp;
      updates.owner_response_at = resp ? new Date().toISOString() : null;
      updates.owner_response_by = resp ? user.id : null;
    }
    if (body.is_pinned !== undefined) {
      updates.is_pinned = Boolean(body.is_pinned);
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from("store_reviews")
    .update(updates)
    .eq("id", reviewId)
    .select()
    .single();

  if (updateErr) {
    console.error("Error updating review:", updateErr);
    return c.json({ error: "Failed to update review" }, 500);
  }

  // biome-ignore lint/suspicious/noExplicitAny: relación inferida
  const storeSlug = (review as any).stores?.slug as string | undefined;
  if (storeSlug) {
    await invalidateCache(c, `/v1/stores/${storeSlug}/reviews`, { name: "store-reviews-list" });
    await invalidateCache(c, `/v1/stores/${storeSlug}/reviews/stats`, { name: "store-reviews-stats" });
  }

  return c.json(updated);
});

/**
 * DELETE /v1/reviews/:id
 *
 * Soft delete. Autor borra su propia review (reason 'author'). Mod/admin pueden
 * borrar con razón opcional en el body.
 */
storeReviewsById.delete("/:id", authMiddleware, async (c) => {
  const reviewId = c.req.param("id");
  const user = c.get("user");
  const role = c.get("userRole") ?? "user";

  let body: { reason?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // Body opcional
  }

  const supabase = createSupabase(c.env, c.get("token"));

  const { data: review, error: fetchErr } = await supabase
    .from("store_reviews")
    .select("id, user_id, store_id, deleted_at, stores:stores!store_reviews_store_id_fkey(slug)")
    .eq("id", reviewId)
    .single();

  if (fetchErr || !review) {
    return c.json({ error: "Review not found" }, 404);
  }

  if (review.deleted_at) {
    return c.json({ error: "Review already deleted" }, 410);
  }

  const isAuthor = review.user_id === user.id;
  const isModOrAdmin = role === "moderator" || role === "admin";

  if (!isAuthor && !isModOrAdmin) {
    return c.json({ error: "Not allowed to delete this review" }, 403);
  }

  const reason = isAuthor && !isModOrAdmin ? "author" : body.reason?.trim() || "moderation";

  const { error: delErr } = await supabase
    .from("store_reviews")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      deleted_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (delErr) {
    console.error("Error soft-deleting review:", delErr);
    return c.json({ error: "Failed to delete review" }, 500);
  }

  // biome-ignore lint/suspicious/noExplicitAny: relación inferida
  const storeSlug = (review as any).stores?.slug as string | undefined;
  if (storeSlug) {
    await invalidateCache(c, `/v1/stores/${storeSlug}/reviews`, { name: "store-reviews-list" });
    await invalidateCache(c, `/v1/stores/${storeSlug}/reviews/stats`, { name: "store-reviews-stats" });
  }

  return c.json({ ok: true });
});

/**
 * POST /v1/reviews/:id/helpful
 *
 * Marca como "útil". Idempotente: si ya existía, no duplica.
 */
storeReviewsById.post("/:id/helpful", authMiddleware, async (c) => {
  const reviewId = c.req.param("id");
  const user = c.get("user");
  const supabase = createSupabase(c.env, c.get("token"));

  const { data: review, error: fetchErr } = await supabase
    .from("store_reviews")
    .select("id, deleted_at, stores:stores!store_reviews_store_id_fkey(slug)")
    .eq("id", reviewId)
    .single();

  if (fetchErr || !review) {
    return c.json({ error: "Review not found" }, 404);
  }
  if (review.deleted_at) {
    return c.json({ error: "Cannot vote on a deleted review" }, 410);
  }

  const { error } = await supabase.from("store_review_helpful").insert({ review_id: reviewId, user_id: user.id });

  if (error) {
    // Duplicate key -> ya votado, idempotente
    if (error.code === "23505") {
      return c.json({ ok: true, already: true });
    }
    console.error("Error inserting helpful vote:", error);
    return c.json({ error: "Failed to mark helpful" }, 500);
  }

  // biome-ignore lint/suspicious/noExplicitAny: relación inferida
  const storeSlug = (review as any).stores?.slug as string | undefined;
  if (storeSlug) {
    await invalidateCache(c, `/v1/stores/${storeSlug}/reviews`, { name: "store-reviews-list" });
  }

  return c.json({ ok: true, already: false });
});

/**
 * DELETE /v1/reviews/:id/helpful
 */
storeReviewsById.delete("/:id/helpful", authMiddleware, async (c) => {
  const reviewId = c.req.param("id");
  const user = c.get("user");
  const supabase = createSupabase(c.env, c.get("token"));

  const { error } = await supabase
    .from("store_review_helpful")
    .delete()
    .eq("review_id", reviewId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error removing helpful vote:", error);
    return c.json({ error: "Failed to remove vote" }, 500);
  }

  return c.json({ ok: true });
});

/**
 * POST /v1/reviews/:id/pin
 *
 * Toggle is_pinned. Requiere ser store member (editor/owner) o admin.
 */
storeReviewsById.post("/:id/pin", authMiddleware, async (c) => {
  const reviewId = c.req.param("id");
  const role = c.get("userRole") ?? "user";
  const supabase = createSupabase(c.env, c.get("token"));

  const { data: review, error: fetchErr } = await supabase
    .from("store_reviews")
    .select("id, store_id, is_pinned, stores:stores!store_reviews_store_id_fkey(slug)")
    .eq("id", reviewId)
    .single();

  if (fetchErr || !review) {
    return c.json({ error: "Review not found" }, 404);
  }

  let allowed = role === "admin";
  if (!allowed) {
    const { data: memberCheck } = await supabase.rpc("is_store_member", {
      p_store_id: review.store_id,
      p_required_role: "editor",
    });
    allowed = memberCheck === true;
  }

  if (!allowed) {
    return c.json({ error: "Not allowed to pin reviews" }, 403);
  }

  const newPinned = !review.is_pinned;
  const { data: updated, error: updErr } = await supabase
    .from("store_reviews")
    .update({ is_pinned: newPinned, updated_at: new Date().toISOString() })
    .eq("id", reviewId)
    .select()
    .single();

  if (updErr) {
    console.error("Error toggling pin:", updErr);
    return c.json({ error: "Failed to toggle pin" }, 500);
  }

  // biome-ignore lint/suspicious/noExplicitAny: relación inferida
  const storeSlug = (review as any).stores?.slug as string | undefined;
  if (storeSlug) {
    await invalidateCache(c, `/v1/stores/${storeSlug}/reviews`, { name: "store-reviews-list" });
  }

  return c.json(updated);
});
