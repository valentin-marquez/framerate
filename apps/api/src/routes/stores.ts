import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware, requireStoreRoleBySlug } from "@/middleware/auth";
import { CACHE_TTL, Cache } from "@/middleware/cache";

const logger = new Logger("Stores");

const stores = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PUBLIC_STORE_FIELDS =
  "id, name, slug, url, website, logo_url, banner_url, description, social, is_active, appearance, owner_user_id, verified_at, created_at, updated_at";

/**
 * GET /v1/stores/:slug
 * Público. Incluye conteo de miembros y rating promedio.
 */
stores.get("/:slug", Cache({ mode: "public", ttl: CACHE_TTL.LONG, name: "store-detail" }), async (c) => {
  const slug = c.req.param("slug");
  const supabase = createSupabase(c.env);

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data: store, error } = await (supabase as any)
    .from("stores")
    .select(PUBLIC_STORE_FIELDS)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !store) {
    return c.json({ error: "Store not found" }, 404);
  }

  // Rating agregado: store_reviews ya existe. Fase 2 expande la tabla.
  const [{ count: memberCount }, { data: ratingRow }] = await Promise.all([
    // biome-ignore lint/suspicious/noExplicitAny: types regen
    (supabase as any)
      .from("store_members")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    supabase
      .from("store_reviews")
      .select("rating")
      .eq("store_id", store.id)
      .then((res) => {
        if (!res.data || res.data.length === 0) return { data: null };
        const avg = res.data.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / res.data.length;
        return { data: { average: avg, count: res.data.length } };
      }),
  ]);

  return c.json({
    ...store,
    member_count: memberCount ?? 0,
    rating: ratingRow ?? { average: null, count: 0 },
  });
});

/**
 * PATCH /v1/stores/:slug
 * Permite a editores actualizar metadata pública. Nunca name/slug/url/is_active.
 */
stores.patch("/:slug", authMiddleware, requireStoreRoleBySlug("slug", "editor"), async (c) => {
  const slug = c.req.param("slug");
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);

  const body = await c.req
    .json<{
      description?: string | null;
      website?: string | null;
      social?: Record<string, string>;
      banner_url?: string | null;
    }>()
    .catch(() => null);

  if (!body) return c.json({ error: "Body inválido" }, 400);

  const updates: Record<string, unknown> = {};
  if (body.description !== undefined) updates.description = body.description;
  if (body.website !== undefined) updates.website = body.website;
  if (body.banner_url !== undefined) updates.banner_url = body.banner_url;
  if (body.social !== undefined) {
    if (typeof body.social !== "object" || body.social === null) {
      return c.json({ error: "social debe ser un objeto" }, 400);
    }
    updates.social = body.social;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nada que actualizar" }, 400);
  }

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data, error } = await (supabase as any)
    .from("stores")
    .update(updates)
    .eq("slug", slug)
    .select(PUBLIC_STORE_FIELDS)
    .single();

  if (error) {
    logger.error(`Update store ${slug}: ${error.message}`);
    return c.json({ error: "No se pudo actualizar la tienda" }, 500);
  }

  return c.json(data);
});

/**
 * GET /v1/stores/:slug/members
 * Lista miembros (requiere editor para ver detalles).
 */
stores.get("/:slug/members", authMiddleware, requireStoreRoleBySlug("slug", "editor"), async (c) => {
  const storeId = c.get("storeId");
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data, error } = await (supabase as any)
    .from("store_members")
    .select("id, user_id, role, invited_by, created_at, profiles:user_id(username, full_name, avatar_url)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ members: data ?? [] });
});

/**
 * POST /v1/stores/:slug/members
 * Owner invita a otro user como editor (por user_id).
 */
stores.post("/:slug/members", authMiddleware, requireStoreRoleBySlug("slug", "owner"), async (c) => {
  const user = c.get("user");
  const storeId = c.get("storeId");
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);

  const body = await c.req.json<{ user_id?: string; role?: "owner" | "editor" }>().catch(() => null);
  if (!body?.user_id) return c.json({ error: "user_id requerido" }, 400);

  const role = body.role === "owner" ? "owner" : "editor";

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data, error } = await (supabase as any)
    .from("store_members")
    .insert({ store_id: storeId, user_id: body.user_id, role, invited_by: user.id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return c.json({ error: "Ya es miembro" }, 409);
    return c.json({ error: error.message }, 500);
  }

  return c.json(data, 201);
});

/**
 * DELETE /v1/stores/:slug/members/:user_id
 */
stores.delete("/:slug/members/:user_id", authMiddleware, requireStoreRoleBySlug("slug", "owner"), async (c) => {
  const storeId = c.get("storeId");
  const userId = c.req.param("user_id");
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { error } = await (supabase as any)
    .from("store_members")
    .delete()
    .eq("store_id", storeId)
    .eq("user_id", userId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

export default stores;
