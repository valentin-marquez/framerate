import { getUserAvatarPath, getUserAvatarUrl, StorageBuckets } from "@framerate/db";
import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";
import { CACHE_TTL, Cache } from "@/middleware/cache";
import { Limit } from "@/middleware/rate-limit";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const logger = new Logger("AuthRoutes");

// Aplica el middleware a todas las rutas en este grupo
auth.use("*", authMiddleware);

// Devuelve el perfil del usuario actual
auth.get("/me", Cache({ mode: "private", ttl: CACHE_TTL.SHORT, name: "auth-me" }), Limit("lenient"), async (c) => {
  const user = c.get("user"); // Obtener el usuario del contexto
  const supabase = createSupabase(c.env, c.get("token"));

  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ user, profile });
});

const ALLOWED_AVATAR_MIME: Record<string, "png" | "jpeg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/webp": "webp",
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB — mismo límite que el bucket

/**
 * POST /v1/auth/sync-avatar
 *
 * Sincroniza el avatar del provider OAuth (Google/Discord/etc.) al bucket
 * `user-avatars`. Idempotente: si el avatar ya está alojado en nuestro storage
 * no hace nada. Pensado para llamarse desde el auth callback del web justo
 * después de `exchangeCodeForSession`.
 *
 * Respuesta: `{ synced: boolean, profile, reason?: string }`.
 */
auth.post("/sync-avatar", Limit("strict"), async (c) => {
  const user = c.get("user");
  const supabase = createSupabase(c.env, c.get("token"));
  const supabaseUrl = c.env.SUPABASE_URL.replace(/\/$/, "");

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (profileError || !profile) {
    logger.warn(`sync-avatar: profile not found for user ${user.id}: ${profileError?.message}`);
    return c.json({ error: "Profile not found" }, 404);
  }

  // Si ya está en nuestro storage, no-op.
  if (profile.avatar_url?.startsWith(`${supabaseUrl}/storage/v1/object/public/user-avatars/`)) {
    return c.json({ synced: false, profile, reason: "already_synced" });
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const externalUrlRaw = metadata.avatar_url ?? metadata.picture;
  const externalUrl = typeof externalUrlRaw === "string" ? externalUrlRaw.trim() : "";

  if (!externalUrl || !/^https:\/\//i.test(externalUrl)) {
    return c.json({ synced: false, profile, reason: "no_external_avatar" });
  }

  let imageResponse: Response;
  try {
    imageResponse = await fetch(externalUrl, { redirect: "follow" });
  } catch (err) {
    logger.warn(`sync-avatar: fetch failed for user ${user.id}: ${(err as Error).message}`);
    return c.json({ synced: false, profile, reason: "fetch_failed" });
  }

  if (!imageResponse.ok) {
    logger.warn(`sync-avatar: external returned ${imageResponse.status} for user ${user.id}`);
    return c.json({ synced: false, profile, reason: `fetch_status_${imageResponse.status}` });
  }

  const contentType = (imageResponse.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const extension = ALLOWED_AVATAR_MIME[contentType];
  if (!extension) {
    logger.warn(`sync-avatar: unsupported content-type "${contentType}" for user ${user.id}`);
    return c.json({ synced: false, profile, reason: "unsupported_mime" });
  }

  const buffer = await imageResponse.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_AVATAR_BYTES) {
    return c.json({ synced: false, profile, reason: "invalid_size" });
  }

  const path = getUserAvatarPath(user.id, extension);
  const { error: uploadError } = await supabase.storage.from(StorageBuckets.USER_AVATARS).upload(path, buffer, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });

  if (uploadError) {
    logger.error(`sync-avatar: upload failed for user ${user.id}: ${uploadError.message}`);
    return c.json({ error: "Failed to upload avatar" }, 500);
  }

  // Cache-buster por updated_at: cuando el usuario reemplace su avatar, la URL cambia.
  const publicUrl = `${getUserAvatarUrl(supabaseUrl, user.id, extension)}?v=${Date.now()}`;

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (updateError || !updated) {
    logger.error(`sync-avatar: profile update failed for user ${user.id}: ${updateError?.message}`);
    return c.json({ error: "Failed to update profile" }, 500);
  }

  return c.json({ synced: true, profile: updated });
});

export default auth;
