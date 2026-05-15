/**
 * @module routes/comments
 *
 * Fase 3: Threaded comments (Reddit-style).
 *
 * Endpoints:
 *   GET    /v1/products/:product_id/comments         → root list + reply count
 *   GET    /v1/comments/:root_id/thread              → full thread
 *   POST   /v1/products/:product_id/comments         → create (root or reply)
 *   PATCH  /v1/comments/:id                          → edit body (≤5min, author)
 *   DELETE /v1/comments/:id                          → soft delete (author / mod)
 *   POST   /v1/comments/:id/vote                     → upvote/downvote/clear
 *
 * Notes:
 *   - All mutations go through Supabase with the user's JWT so RLS enforces
 *     the trust boundary. The API just performs validation & shaping.
 *   - Cache TTL kept short (1min) because threads update frequently.
 *   - Soft-deleted bodies are nulled out on the server side; the RPC also
 *     redacts but we belt-and-suspender it in case rows come back without it.
 */

import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";
import { Cache } from "@/middleware/cache";

const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Hono Cache middleware doesn't take effect for non-GET; for GETs we explicitly
// shape it per route. Mutations go through authMiddleware.

const COMMENTS_CACHE_TTL = 60; // 1 minute. Threads churn faster than product details.

// ---------------------------------------------------------------------------
// GET /products/:product_id/comments → root comments for a product
// ---------------------------------------------------------------------------
comments.get(
  "/products/:product_id/comments",
  Cache({ mode: "public", ttl: COMMENTS_CACHE_TTL, name: "product-comments" }),
  async (c) => {
    const productId = c.req.param("product_id");
    const sort = c.req.query("sort") || "best";
    const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), 100);
    const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

    if (!["best", "recent", "old"].includes(sort)) {
      return c.json({ error: "sort must be one of: best, recent, old" }, 400);
    }

    const supabase = createSupabase(c.env);

    const { data, error } = await supabase.rpc("get_product_comments", {
      p_product_id: productId,
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("Error fetching product comments:", error);
      return c.json({ error: error.message }, 500);
    }

    // Defence-in-depth: redact deleted bodies even though the RPC already does.
    type Row = {
      id: string;
      body: string | null;
      deleted_at: string | null;
      [k: string]: unknown;
    };
    const cleaned = (data as Row[] | null)?.map((row) => ({
      ...row,
      body: row.deleted_at ? null : row.body,
    }));

    return c.json({ data: cleaned ?? [], meta: { sort, limit, offset } });
  },
);

// ---------------------------------------------------------------------------
// GET /comments/:root_id/thread → entire thread, BFS-ordered by ltree path
// ---------------------------------------------------------------------------
comments.get(
  "/comments/:root_id/thread",
  Cache({ mode: "public", ttl: COMMENTS_CACHE_TTL, name: "comment-thread" }),
  async (c) => {
    const rootId = c.req.param("root_id");
    const limit = Math.min(Math.max(Number(c.req.query("limit")) || 200, 1), 500);

    const supabase = createSupabase(c.env);

    const { data, error } = await supabase.rpc("get_comment_thread", {
      p_root_id: rootId,
      p_limit: limit,
    });

    if (error) {
      console.error("Error fetching comment thread:", error);
      return c.json({ error: error.message }, 500);
    }

    type Row = {
      id: string;
      body: string | null;
      deleted_at: string | null;
      [k: string]: unknown;
    };
    const cleaned = (data as Row[] | null)?.map((row) => ({
      ...row,
      body: row.deleted_at ? null : row.body,
    }));

    return c.json({ data: cleaned ?? [], meta: { rootId, limit } });
  },
);

// ---------------------------------------------------------------------------
// Authenticated mutations
// ---------------------------------------------------------------------------
const authed = new Hono<{ Bindings: Bindings; Variables: Variables }>();
authed.use("*", authMiddleware);

// POST /products/:product_id/comments → create root or reply
authed.post("/products/:product_id/comments", async (c) => {
  const productId = c.req.param("product_id");
  const user = c.get("user");
  const token = c.get("token");

  let body: { parent_id?: string | null; body?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const text = (body.body || "").trim();
  if (!text) return c.json({ error: "body is required" }, 400);
  if (text.length > 5000) return c.json({ error: "body too long (max 5000 chars)" }, 400);

  const supabase = createSupabase(c.env, token);

  // Optional: confirm product exists before bothering Supabase with FK errors.
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (productError || !product) {
    return c.json({ error: "Product not found" }, 404);
  }

  const insertPayload = {
    target_type: "product" as const,
    target_id: productId,
    parent_id: body.parent_id ?? null,
    author_id: user.id,
    body: text,
    // path / root_id / depth get filled by trigger.
    // We supply placeholders that the trigger will overwrite — they're NOT NULL
    // so we have to pass *something* the trigger can later replace.
    root_id: user.id, // overwritten by trigger
    path: "placeholder", // overwritten by trigger
  };

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert(insertPayload)
    .select("id, target_id, parent_id, root_id, depth, body, score, created_at")
    .single();

  if (error) {
    console.error("Error inserting comment:", error);
    const status = error.code === "42501" ? 403 : 500;
    return c.json({ error: error.message }, status);
  }

  return c.json({ data: inserted }, 201);
});

// PATCH /comments/:id → edit body (RLS validates 5-min window + author)
authed.patch("/comments/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const token = c.get("token");

  let body: { body?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const text = (body.body || "").trim();
  if (!text) return c.json({ error: "body is required" }, 400);
  if (text.length > 5000) return c.json({ error: "body too long (max 5000 chars)" }, 400);

  const supabase = createSupabase(c.env, token);

  // Belt-and-suspenders: also enforce the 5-min window in app layer so we can
  // return a friendly error before hitting RLS.
  const { data: existing } = await supabase
    .from("comments")
    .select("id, author_id, created_at, deleted_at")
    .eq("id", id)
    .single();

  if (!existing) return c.json({ error: "Comment not found" }, 404);
  if (existing.author_id !== user.id) return c.json({ error: "Not the author" }, 403);
  if (existing.deleted_at) return c.json({ error: "Comment is deleted" }, 409);
  const createdAtMs = new Date(existing.created_at).getTime();
  if (Date.now() - createdAtMs > 5 * 60 * 1000) {
    return c.json({ error: "Edit window (5 minutes) has expired" }, 409);
  }

  const { data, error } = await supabase
    .from("comments")
    .update({ body: text })
    .eq("id", id)
    .select("id, body, edited_at, score")
    .single();

  if (error) {
    console.error("Error updating comment:", error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// DELETE /comments/:id → soft delete. Author can always soft-delete their own;
// moderators/admins can soft-delete anyone with a reason.
authed.delete("/comments/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const token = c.get("token");

  // Reason is optional; required only for moderator deletions but we don't
  // gate on role at the API layer — RLS handles it. If you're the author it's
  // forced to 'author'.
  let reasonFromBody: string | undefined;
  try {
    const parsed = await c.req.json<{ reason?: string }>();
    reasonFromBody = parsed.reason;
  } catch {
    // Empty body is fine for author deletions.
  }

  const supabase = createSupabase(c.env, token);

  const { data: existing } = await supabase.from("comments").select("id, author_id, deleted_at").eq("id", id).single();

  if (!existing) return c.json({ error: "Comment not found" }, 404);
  if (existing.deleted_at) return c.json({ error: "Already deleted" }, 409);

  const isAuthor = existing.author_id === user.id;
  const reason = isAuthor ? "author" : reasonFromBody?.trim() || "moderator";

  const { data, error } = await supabase
    .from("comments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      deleted_reason: reason,
    })
    .eq("id", id)
    .select("id, deleted_at, deleted_reason")
    .single();

  if (error) {
    console.error("Error soft-deleting comment:", error);
    const status = error.code === "42501" ? 403 : 500;
    return c.json({ error: error.message }, status);
  }

  return c.json({ data });
});

// POST /comments/:id/vote → upsert / clear vote
authed.post("/comments/:id/vote", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const token = c.get("token");

  let payload: { value?: number };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const value = payload.value;
  if (value !== -1 && value !== 0 && value !== 1) {
    return c.json({ error: "value must be -1, 0, or 1" }, 400);
  }

  const supabase = createSupabase(c.env, token);

  if (value === 0) {
    const { error } = await supabase.from("comment_votes").delete().eq("comment_id", id).eq("user_id", user.id);
    if (error) {
      console.error("Error clearing vote:", error);
      return c.json({ error: error.message }, 500);
    }
  } else {
    const { error } = await supabase
      .from("comment_votes")
      .upsert({ comment_id: id, user_id: user.id, value }, { onConflict: "comment_id,user_id" });
    if (error) {
      console.error("Error voting:", error);
      const status = error.code === "42501" ? 403 : 500;
      return c.json({ error: error.message }, status);
    }
  }

  // Re-read the new score so the client can apply it without an extra request.
  const { data: scoreRow } = await supabase.from("comments").select("id, score").eq("id", id).single();

  return c.json({ data: { id, value, score: scoreRow?.score ?? 0 } });
});

// GET /comments/me/votes?ids=a,b,c → current user's votes on a set of comments
authed.get("/comments/me/votes", async (c) => {
  const idsParam = c.req.query("ids");
  if (!idsParam) return c.json({ data: [] });
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return c.json({ data: [] });

  const supabase = createSupabase(c.env, c.get("token"));
  const { data, error } = await supabase.rpc("get_my_comment_votes", { p_comment_ids: ids });
  if (error) {
    console.error("Error fetching my votes:", error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ data: data ?? [] });
});

comments.route("/", authed);

export default comments;
