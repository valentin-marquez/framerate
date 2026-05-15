import { redirect } from "react-router";
import { createSupabaseServerClient } from "@/shared/services/supabase.server";

/**
 * Roles globales emitidos como claims del JWT por
 * public.custom_access_token_hook.
 */
export type UserRole = "user" | "moderator" | "admin";

const ROLE_RANK: Record<UserRole, number> = {
  user: 1,
  moderator: 2,
  admin: 3,
};

const VALID_ROLES = new Set<UserRole>(["user", "moderator", "admin"]);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    // Buffer está disponible en SSR (Node-compat de Cloudflare). Fallback a atob.
    const json = typeof Buffer !== "undefined" ? Buffer.from(padded, "base64").toString("utf-8") : atob(padded);
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

function rolesFromSession(accessToken: string | null | undefined): {
  role: UserRole;
  roles: UserRole[];
} {
  if (!accessToken) return { role: "user", roles: ["user"] };
  const payload = decodeJwtPayload(accessToken);
  const role = normalizeRole(payload?.user_role);
  const rolesRaw = Array.isArray(payload?.user_roles) ? payload?.user_roles : [];
  const roles: UserRole[] = [];
  for (const v of rolesRaw as unknown[]) {
    if (typeof v === "string" && VALID_ROLES.has(v as UserRole)) {
      roles.push(v as UserRole);
    }
  }
  return { role, roles: roles.length > 0 ? roles : [role] };
}

export async function requireAuth(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw redirect("/", { headers });
  }

  return { user, supabase, headers };
}

export async function getAuthUser(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabase, headers };
}

export async function getSession(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { session, supabase, headers };
}

/**
 * Devuelve el rol del usuario actual leyendo el claim `user_role` del JWT.
 * Si no hay sesión o el claim no existe, devuelve `"user"`.
 */
export async function getUserRole(request: Request): Promise<UserRole> {
  const { session } = await getSession(request);
  return rolesFromSession(session?.access_token).role;
}

/**
 * Exige que el usuario tenga un rol global >= `role`. Si no autenticado,
 * redirige a `/`. Si autenticado pero sin permisos, redirige a `/` (Fase 0
 * mantiene el flujo simple; las páginas pueden mostrar mensaje propio si
 * fuera necesario).
 *
 * @example
 * export async function loader({ request }: Route.LoaderArgs) {
 *   const { user, supabase, headers } = await requireRole(request, "moderator");
 *   // ...
 * }
 */
export async function requireRole(request: Request, role: Exclude<UserRole, "user">) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    throw redirect("/", { headers });
  }

  const { role: currentRole, roles } = rolesFromSession(session.access_token);

  if (ROLE_RANK[currentRole] < ROLE_RANK[role]) {
    throw redirect("/", { headers });
  }

  return { user: session.user, role: currentRole, roles, supabase, headers };
}
