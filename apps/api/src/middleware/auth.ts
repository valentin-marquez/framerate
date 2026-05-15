import { Logger } from "@framerate/utils";
import { createMiddleware } from "hono/factory";
import type { Bindings, UserRole, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";

const logger = new Logger("AuthMiddleware");

const ROLE_RANK: Record<UserRole, number> = {
  user: 1,
  moderator: 2,
  admin: 3,
};

const VALID_ROLES = new Set<UserRole>(["user", "moderator", "admin"]);

/**
 * Decodifica el payload de un JWT (sin verificar la firma — la verificación la
 * hace supabase.auth.getUser). Devuelve null si el formato es inválido.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeRole(value: unknown): UserRole {
  if (typeof value === "string" && VALID_ROLES.has(value as UserRole)) {
    return value as UserRole;
  }
  return "user";
}

function normalizeRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value)) return ["user"];
  const roles = value
    .filter((v): v is string => typeof v === "string")
    .filter((v): v is UserRole => VALID_ROLES.has(v as UserRole));
  return roles.length > 0 ? roles : ["user"];
}

export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    logger.warn("Missing Authorization header");
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createSupabase(c.env);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    logger.warn(`Invalid token: ${error?.message}`);
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Extraemos los claims user_role / user_roles inyectados por
  // public.custom_access_token_hook. Si el JWT no los trae (cuenta vieja
  // o hook deshabilitado), caemos a "user".
  const payload = decodeJwtPayload(token);
  const userRole = normalizeRole(payload?.user_role);
  const userRoles = normalizeRoles(payload?.user_roles);

  c.set("user", user);
  c.set("token", token);
  c.set("userRole", userRole);
  c.set("userRoles", userRoles);

  await next();
});

/**
 * Middleware que exige un rol global mínimo. Debe encadenarse después de
 * `authMiddleware`. Si el usuario no califica, devuelve 403.
 *
 * @example
 * profiles.use("/admin/*", authMiddleware, requireRole("admin"));
 */
export const requireRole = (role: UserRole) =>
  createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const userRole = c.get("userRole");
    if (!userRole) {
      logger.warn("requireRole invoked without authMiddleware upstream");
      return c.json({ error: "Authentication required" }, 401);
    }

    if (ROLE_RANK[userRole] < ROLE_RANK[role]) {
      logger.warn(`User ${c.get("user")?.id} lacks role '${role}' (has '${userRole}')`);
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
  });

/**
 * Middleware que exige membresía en una tienda específica con un rol mínimo.
 * Llama al RPC `public.is_store_member` (Fase 0 devuelve siempre false; la
 * Fase 1 implementa la lógica real contra `store_members`).
 *
 * Debe encadenarse después de `authMiddleware`.
 *
 * @param storeIdParam Nombre del parámetro de ruta que contiene el storeId.
 * @param role         Rol requerido dentro de la tienda (default "editor").
 */
export const requireStoreRole = (storeIdParam: string, role: string = "editor") =>
  createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const token = c.get("token");
    if (!token) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const storeId = c.req.param(storeIdParam);
    if (!storeId) {
      return c.json({ error: `Missing route param '${storeIdParam}'` }, 400);
    }

    // Admin global tiene paso libre.
    if (c.get("userRole") === "admin") {
      await next();
      return;
    }

    const supabase = createSupabase(c.env, token);
    const { data, error } = await supabase.rpc("is_store_member", {
      p_store_id: storeId,
      p_required_role: role,
    });

    if (error) {
      logger.error(`is_store_member rpc failed: ${error.message}`);
      return c.json({ error: "Authorization check failed" }, 500);
    }

    if (data !== true) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
  });

/**
 * Fase 1: variante de `requireStoreRole` que acepta un slug en lugar de un UUID.
 * Resuelve el slug a `store_id` antes de llamar al RPC. Útil para rutas
 * `/v1/stores/:slug/...`.
 *
 * Deja el `storeId` resuelto en `c.var.storeId` para que el handler lo reutilice.
 */
export const requireStoreRoleBySlug = (slugParam: string = "slug", role: "owner" | "editor" = "editor") =>
  createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const token = c.get("token");
    if (!token) return c.json({ error: "Authentication required" }, 401);

    const slug = c.req.param(slugParam);
    if (!slug) return c.json({ error: `Missing route param '${slugParam}'` }, 400);

    const supabase = createSupabase(c.env, token);
    const { data: store, error: storeErr } = await supabase.from("stores").select("id").eq("slug", slug).maybeSingle();
    if (storeErr || !store) return c.json({ error: "Store not found" }, 404);

    c.set("storeId", store.id);

    if (c.get("userRole") === "admin") {
      await next();
      return;
    }

    const { data, error } = await supabase.rpc("is_store_member", {
      p_store_id: store.id,
      p_required_role: role,
    });
    if (error) {
      logger.error(`is_store_member rpc failed: ${error.message}`);
      return c.json({ error: "Authorization check failed" }, 500);
    }
    if (data !== true) return c.json({ error: "Forbidden" }, 403);
    await next();
  });
