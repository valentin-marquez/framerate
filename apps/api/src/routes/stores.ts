import { getStoreAssetPath, StorageBuckets, type StoreAssetExtension, storeAssetUrlFromPath } from "@framerate/db";
import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { normalizeDomain } from "@/lib/domain";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware, requireStoreRoleBySlug } from "@/middleware/auth";
import { CACHE_TTL, Cache } from "@/middleware/cache";
import { Limit } from "@/middleware/rate-limit";

const logger = new Logger("Stores");

const stores = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Modelo: `stores` es canónico (lo escribe migración/scraper, read-only para
 * el dueño). `store_profiles` (1:1) es la capa editable por el dueño. La
 * propiedad vive en `accounts` + `account_members` (la account gobierna todas
 * sus tiendas). El render público hace COALESCE(profile, canónico/legacy).
 */

// Canónico únicamente (las columnas legacy website/banner_url/description/social
// fueron dropeadas en la migración phase 6). Toda la capa editable vive en
// store_profiles.
const STORE_BASE_SELECT = `
  id, name, slug, url, is_active, account_id, scraped_icon_path,
  verified_at, created_at, updated_at,
  profile:store_profiles(display_name, description, website, social, icon_path, banner_path, updated_at),
  account:accounts!stores_account_id_fkey(id, slug, name)
`;

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  url: string | null;
  is_active: boolean;
  account_id: string | null;
  scraped_icon_path: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    display_name: string | null;
    description: string | null;
    website: string | null;
    social: Record<string, string> | null;
    icon_path: string | null;
    banner_path: string | null;
    updated_at: string | null;
  } | null;
  account?: { id: string; slug: string; name: string } | null;
}

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function hasKeys(o: Record<string, unknown> | null | undefined): boolean {
  return !!o && Object.keys(o).length > 0;
}

/** Sufijo cache-buster para assets del dueño (el path del objeto no cambia). */
function bust(url: string | null, updatedAt: string | null | undefined): string | null {
  if (!url) return null;
  const v = updatedAt ? new Date(updatedAt).getTime() : 0;
  return v ? `${url}?v=${v}` : url;
}

/**
 * Compone la identidad pública de la tienda: el dueño (store_profiles) pisa el
 * dato canónico/legacy. Assets se resuelven a URL pública del bucket
 * store-assets (el front la proxia vía getImageUrl).
 */
function composeStore(
  row: StoreRow,
  supabaseUrl: string,
  extra: { member_count: number; rating: { average: number | null; count: number } },
) {
  const profile = toOne(row.profile);
  const account = toOne(row.account);

  const iconFromOwner = profile?.icon_path
    ? bust(storeAssetUrlFromPath(supabaseUrl, profile.icon_path), profile.updated_at)
    : null;
  const iconCanonical = storeAssetUrlFromPath(supabaseUrl, row.scraped_icon_path);
  const bannerFromOwner = profile?.banner_path
    ? bust(storeAssetUrlFromPath(supabaseUrl, profile.banner_path), profile.updated_at)
    : null;

  return {
    id: row.id,
    name: profile?.display_name || row.name,
    // Nombre canónico y override crudo (para que el panel de admin pueda
    // prellenar el campo y distinguir "sin override").
    canonical_name: row.name,
    display_name: profile?.display_name ?? null,
    slug: row.slug,
    url: row.url,
    website: profile?.website ?? null,
    // logo_url/appearance quedaron obsoletos (StoreLogo usa icon_url). Se
    // mantienen las keys por compat del tipo del front hasta la limpieza.
    logo_url: null as string | null,
    appearance: "light" as const,
    icon_url: iconFromOwner ?? iconCanonical,
    banner_url: bannerFromOwner ?? null,
    description: profile?.description ?? null,
    social: hasKeys(profile?.social) ? profile?.social : {},
    is_active: row.is_active,
    is_claimed: row.account_id !== null,
    account,
    owner_user_id: null as string | null,
    verified_at: row.verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    member_count: extra.member_count,
    rating: extra.rating,
  };
}

async function memberCountForAccount(
  // biome-ignore lint/suspicious/noExplicitAny: supabase client types regen
  supabase: any,
  accountId: string | null,
): Promise<number> {
  if (!accountId) return 0;
  const { count } = await supabase
    .from("account_members")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  return count ?? 0;
}

/**
 * GET /v1/stores
 * Público. Lista de tiendas del catálogo para el selector de "reclamar tienda".
 * `is_claimed` = la tienda ya tiene account dueña. `domain` = dominio
 * verificable derivado de `url` (lo que se verifica por DNS).
 */
stores.get("/", Cache({ mode: "public", ttl: CACHE_TTL.SHORT, name: "stores-list" }), Limit("moderate"), async (c) => {
  const q = c.req.query("q")?.trim();
  const supabase = createSupabase(c.env);
  const supabaseUrl = (c.env.SUPABASE_URL || Bun.env.SUPABASE_URL || "").replace(/\/$/, "");

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  let query = (supabase as any)
    .from("stores")
    .select("id, name, slug, url, account_id, scraped_icon_path, profile:store_profiles(display_name, icon_path)")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(100);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    logger.error(`List stores: ${error.message}`);
    return c.json({ error: "No se pudieron listar las tiendas" }, 500);
  }

  const list = (data ?? []).map(
    (s: {
      id: string;
      name: string;
      slug: string;
      url: string | null;
      account_id: string | null;
      scraped_icon_path: string | null;
      profile?:
        | { display_name: string | null; icon_path: string | null }
        | { display_name: string | null; icon_path: string | null }[]
        | null;
    }) => {
      const profile = toOne(s.profile);
      const iconPath = profile?.icon_path ?? s.scraped_icon_path;
      return {
        id: s.id,
        name: profile?.display_name || s.name,
        slug: s.slug,
        icon_url: storeAssetUrlFromPath(supabaseUrl, iconPath),
        // Dominio verificable derivado de url; null => no se puede reclamar por DNS.
        domain: s.url ? normalizeDomain(s.url) : null,
        is_claimed: s.account_id !== null,
      };
    },
  );

  return c.json({ stores: list });
});

/**
 * GET /v1/stores/:slug
 * Público. Identidad mergeada (owner pisa canónico) + conteo de miembros de la
 * account dueña + rating promedio.
 */
stores.get(
  "/:slug",
  Cache({ mode: "public", ttl: CACHE_TTL.LONG, name: "store-detail" }),
  Limit("moderate"),
  async (c) => {
    const slug = c.req.param("slug");
    const supabase = createSupabase(c.env);
    const supabaseUrl = (c.env.SUPABASE_URL || Bun.env.SUPABASE_URL || "").replace(/\/$/, "");

    // biome-ignore lint/suspicious/noExplicitAny: types regen
    const { data: store, error } = await (supabase as any)
      .from("stores")
      .select(STORE_BASE_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    if (error || !store) {
      return c.json({ error: "Store not found" }, 404);
    }

    const [memberCount, { data: ratingRow }] = await Promise.all([
      memberCountForAccount(supabase, store.account_id),
      supabase
        .from("store_reviews")
        .select("rating")
        .eq("store_id", store.id)
        .then((res: { data: { rating: number }[] | null }) => {
          if (!res.data || res.data.length === 0) return { data: null };
          const avg = res.data.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / res.data.length;
          return { data: { average: avg, count: res.data.length } };
        }),
    ]);

    return c.json(
      composeStore(store as StoreRow, supabaseUrl, {
        member_count: memberCount,
        rating: ratingRow ?? { average: null, count: 0 },
      }),
    );
  },
);

/**
 * PATCH /v1/stores/:slug
 * Editor+ de la account dueña. Escribe SOLO store_profiles (capa editable).
 * Nunca toca columnas canónicas (name/slug/url/is_active) ni assets (eso es
 * POST /:slug/assets).
 */
stores.patch("/:slug", Limit("moderate"), authMiddleware, requireStoreRoleBySlug("slug", "editor"), async (c) => {
  const storeId = c.get("storeId");
  if (!storeId) return c.json({ error: "Tienda no resuelta" }, 500);
  const user = c.get("user");
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);
  const supabaseUrl = (c.env.SUPABASE_URL || Bun.env.SUPABASE_URL || "").replace(/\/$/, "");

  const body = await c.req
    .json<{
      display_name?: string | null;
      description?: string | null;
      website?: string | null;
      social?: Record<string, string>;
    }>()
    .catch(() => null);

  if (!body) return c.json({ error: "Body inválido" }, 400);

  const updates: Record<string, unknown> = { store_id: storeId, updated_by: user.id };
  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.website !== undefined) updates.website = body.website;
  if (body.social !== undefined) {
    if (typeof body.social !== "object" || body.social === null) {
      return c.json({ error: "social debe ser un objeto" }, 400);
    }
    updates.social = body.social;
  }

  if (Object.keys(updates).length <= 2) {
    return c.json({ error: "Nada que actualizar" }, 400);
  }

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { error: upErr } = await (supabase as any).from("store_profiles").upsert(updates, { onConflict: "store_id" });

  if (upErr) {
    logger.error(`Update store profile ${slugFrom(c)}: ${upErr.message}`);
    return c.json({ error: "No se pudo actualizar la tienda" }, 500);
  }

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data: store } = await (supabase as any)
    .from("stores")
    .select(STORE_BASE_SELECT)
    .eq("id", storeId)
    .maybeSingle();

  if (!store) return c.json({ error: "Store not found" }, 404);

  const memberCount = await memberCountForAccount(supabase, store.account_id);
  return c.json(
    composeStore(store as StoreRow, supabaseUrl, { member_count: memberCount, rating: { average: null, count: 0 } }),
  );
});

function slugFrom(c: { req: { param: (k: string) => string } }): string {
  return c.req.param("slug");
}

const STORE_ASSET_MIME: Record<string, StoreAssetExtension> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};
const MAX_STORE_ASSET_BYTES = 5 * 1024 * 1024;

/**
 * POST /v1/stores/:slug/assets   (multipart: kind=icon|banner, file=<imagen>)
 * Editor+ de la account dueña. Sube el asset al bucket store-assets bajo
 * {store_id}/{kind}.<ext> y persiste el path en store_profiles. Reemplaza el
 * hotlink: el asset queda en nuestro Storage y sobrevive a re-scrapes.
 */
stores.post("/:slug/assets", Limit("moderate"), authMiddleware, requireStoreRoleBySlug("slug", "editor"), async (c) => {
  const storeId = c.get("storeId");
  if (!storeId) return c.json({ error: "Tienda no resuelta" }, 500);
  const user = c.get("user");
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);
  const supabaseUrl = (c.env.SUPABASE_URL || Bun.env.SUPABASE_URL || "").replace(/\/$/, "");

  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: "multipart/form-data requerido" }, 400);

  const kind = String(form.get("kind") ?? "");
  if (kind !== "icon" && kind !== "banner") {
    return c.json({ error: "kind debe ser 'icon' o 'banner'" }, 400);
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return c.json({ error: "file requerido" }, 400);
  }

  const mime = (file.type || "").split(";")[0].trim().toLowerCase();
  const ext = STORE_ASSET_MIME[mime];
  if (!ext) {
    return c.json({ error: `Tipo no soportado: ${mime || "desconocido"}` }, 415);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) return c.json({ error: "Archivo vacío" }, 400);
  if (bytes.byteLength > MAX_STORE_ASSET_BYTES) {
    return c.json({ error: "El archivo excede 5MB" }, 413);
  }

  const path = getStoreAssetPath(storeId, kind, ext);
  const { error: upErr } = await supabase.storage
    .from(StorageBuckets.STORE_ASSETS)
    .upload(path, bytes, { contentType: mime, upsert: true, cacheControl: "31536000" });

  if (upErr) {
    logger.error(`Asset upload ${slugFrom(c)}/${kind}: ${upErr.message}`);
    return c.json({ error: "No se pudo subir el archivo" }, 500);
  }

  const column = kind === "icon" ? "icon_path" : "banner_path";
  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { error: profErr } = await (supabase as any)
    .from("store_profiles")
    .upsert({ store_id: storeId, [column]: path, updated_by: user.id }, { onConflict: "store_id" });

  if (profErr) {
    logger.error(`Asset profile upsert ${slugFrom(c)}/${kind}: ${profErr.message}`);
    return c.json({ error: "No se pudo registrar el asset" }, 500);
  }

  const url = bust(storeAssetUrlFromPath(supabaseUrl, path), new Date().toISOString());
  return c.json({ kind, path, url });
});

/**
 * GET /v1/stores/:slug/me
 * Rol del viewer sobre esta tienda (vía la account dueña):
 *   - 'admin' si tiene rol global admin.
 *   - 'owner' | 'admin' | 'editor' si es miembro de la account dueña.
 *   - null si no es miembro ni admin global (o la tienda no está reclamada).
 */
stores.get("/:slug/me", Limit("lenient"), authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const user = c.get("user");
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);

  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id, account_id")
    .eq("slug", slug)
    .maybeSingle();

  if (storeErr || !store) {
    return c.json({ error: "Store not found" }, 404);
  }

  if (c.get("userRole") === "admin") {
    return c.json({ role: "admin" as const });
  }

  if (!store.account_id) {
    return c.json({ role: null });
  }

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data: membership } = await (supabase as any)
    .from("account_members")
    .select("role")
    .eq("account_id", store.account_id)
    .eq("user_id", user.id)
    .maybeSingle();

  return c.json({ role: (membership?.role as "owner" | "admin" | "editor" | null) ?? null });
});

/**
 * GET /v1/stores/:slug/members
 * Lista miembros de la account dueña (requiere editor+).
 */
stores.get("/:slug/members", Limit("moderate"), authMiddleware, requireStoreRoleBySlug("slug", "editor"), async (c) => {
  const storeId = c.get("storeId");
  if (!storeId) return c.json({ error: "Tienda no resuelta" }, 500);
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);

  const { data: store } = await supabase.from("stores").select("account_id").eq("id", storeId).maybeSingle();
  if (!store?.account_id) return c.json({ members: [] });

  // PostgREST no resuelve el join embedded `profiles:user_id(...)` porque el FK
  // declarado en `account_members.user_id` apunta a `auth.users(id)`, no a
  // `public.profiles`. Hacemos dos queries y unimos en memoria manteniendo la
  // shape `{ members: [{ ..., profiles: {...} }] }` esperada por el front.
  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data: members, error } = await (supabase as any)
    .from("account_members")
    .select("id, user_id, role, invited_by, created_at")
    .eq("account_id", store.account_id)
    .order("created_at", { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (!members || members.length === 0) {
    return c.json({ members: [] });
  }

  const userIds = members.map((m: { user_id: string }) => m.user_id);
  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data: profilesData } = await (supabase as any)
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", userIds);

  const profilesById = new Map((profilesData ?? []).map((p: { id: string; [k: string]: unknown }) => [p.id, p]));

  const enriched = members.map((m: { user_id: string; [k: string]: unknown }) => {
    const profile = profilesById.get(m.user_id) as
      | { username: string | null; full_name: string | null; avatar_url: string | null }
      | undefined;
    return {
      ...m,
      profiles: profile
        ? {
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          }
        : null,
    };
  });

  return c.json({ members: enriched });
});

/**
 * POST /v1/stores/:slug/members
 * Admin+ de la account invita a otro user (owner|admin|editor).
 */
stores.post("/:slug/members", Limit("moderate"), authMiddleware, requireStoreRoleBySlug("slug", "owner"), async (c) => {
  const user = c.get("user");
  const storeId = c.get("storeId");
  if (!storeId) return c.json({ error: "Tienda no resuelta" }, 500);
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);

  const { data: store } = await supabase.from("stores").select("account_id").eq("id", storeId).maybeSingle();
  if (!store?.account_id) {
    return c.json({ error: "La tienda no está reclamada (sin account)" }, 409);
  }

  const body = await c.req.json<{ user_id?: string; role?: "owner" | "admin" | "editor" }>().catch(() => null);
  if (!body?.user_id) return c.json({ error: "user_id requerido" }, 400);

  const role = body.role === "owner" ? "owner" : body.role === "admin" ? "admin" : "editor";

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data, error } = await (supabase as any)
    .from("account_members")
    .insert({ account_id: store.account_id, user_id: body.user_id, role, invited_by: user.id })
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
 * Admin+ de la account remueve un miembro.
 */
stores.delete(
  "/:slug/members/:user_id",
  Limit("moderate"),
  authMiddleware,
  requireStoreRoleBySlug("slug", "owner"),
  async (c) => {
    const storeId = c.get("storeId");
    if (!storeId) return c.json({ error: "Tienda no resuelta" }, 500);
    const userId = c.req.param("user_id");
    const token = c.get("token");
    const supabase = createSupabase(c.env, token);

    const { data: store } = await supabase.from("stores").select("account_id").eq("id", storeId).maybeSingle();
    if (!store?.account_id) return c.json({ ok: true });

    // biome-ignore lint/suspicious/noExplicitAny: types regen
    const { error } = await (supabase as any)
      .from("account_members")
      .delete()
      .eq("account_id", store.account_id)
      .eq("user_id", userId);

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
  },
);

export default stores;
