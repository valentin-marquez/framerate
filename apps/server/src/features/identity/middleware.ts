import { hasRole, type Role } from "@framerate/contracts";
import type { Context, MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "@/app";
import { AppError } from "@/shared/http/errors";
import { timingSafeEqual } from "@/shared/http/middleware";
import { authD1, getAuth } from "./auth-instance";
import { loadSessionUser } from "./identity.repository";
import { type Actor, actorRole, type SessionUser } from "./types";

/**
 * Autenticación y autorización de rutas.
 *
 *  - `requireUser`      → cualquier usuario con sesión (cookie de Better Auth).
 *  - `requireStaff(rol)`→ personal: sesión con rol suficiente, o el token de servicio (scripts).
 *
 * La sesión sólo identifica al usuario: su rol y su sanción se leen SIEMPRE de la
 * base, así un ban o un cambio de rol aplican de inmediato (no al vencer una cookie).
 */

async function sessionUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  // Sin cookie de sesión no hay nada que validar: el visitante anónimo no paga cargar Better Auth ni un acceso a D1.
  if (!c.req.header("cookie")?.includes("session_token")) return null;
  const start = Date.now();
  const accessesBefore = authD1.accesses;
  const { headers, response: session } = await (await getAuth(c.env)).api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  });
  // Al leer de D1, Better Auth renueva la caché de la sesión en una cookie: si no llega al navegador, la caché no sirve.
  for (const cookie of headers.getSetCookie()) c.header("set-cookie", cookie, { append: true });
  // Better Auth consulta D1 por su cuenta y su primer uso en un isolate inicializa: nada de eso pasa por `d1;dur`.
  c.header("Server-Timing", `session;dur=${Date.now() - start};desc="${authD1.accesses - accessesBefore} accesos"`, {
    append: true,
  });
  if (!session) return null;
  const loaded = await loadSessionUser(c.var.db, session.user.id, new Date().toISOString());
  if (!loaded) return null;
  c.set("userRow", loaded.row);
  return loaded.user;
}

/**
 * Defensa contra CSRF para escrituras con cookie: si el navegador declara un
 * `Origin`, tiene que ser el de nuestra web. Sin `Origin` (curl, scripts) se
 * permite: un sitio ajeno no puede forjar esa ausencia desde un navegador.
 */
function assertTrustedOrigin(c: Context<AppEnv>) {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) return;
  const origin = c.req.header("origin");
  if (origin && origin !== c.env.WEB_ORIGIN) throw new AppError(403, "bad_origin", "Origen no permitido");
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await sessionUser(c);
  if (!user) throw new AppError(401, "unauthorized", "Inicia sesión para continuar");
  assertTrustedOrigin(c);
  c.set("user", user);
  await next();
};

/** Identifica al visitante si trae sesión, sin exigirla (lecturas públicas que cambian según quién mira, soporte). */
export const optionalUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await sessionUser(c);
  if (user) {
    assertTrustedOrigin(c);
    c.set("user", user);
  }
  await next();
};

async function resolveActor(c: Context<AppEnv>): Promise<Actor | null> {
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    if (c.env.ADMIN_TOKEN && (await timingSafeEqual(token, c.env.ADMIN_TOKEN))) return { kind: "token" };
    for (const entry of (c.env.ADMIN_TOKENS ?? "").split(",")) {
      const [name, expected] = entry.trim().split(":");
      if (name && expected && (await timingSafeEqual(token, expected))) return { kind: "token", name };
    }
    throw new AppError(401, "unauthorized", "Token de administrador inválido");
  }
  const user = await sessionUser(c);
  return user ? { kind: "user", user } : null;
}

export const requireStaff =
  (minimum: Role = "moderator"): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const actor = await resolveActor(c);
    if (!actor) throw new AppError(401, "unauthorized", "Inicia sesión para continuar");
    if (!hasRole(actorRole(actor), minimum)) throw new AppError(403, "forbidden", "No tienes permisos para esto");
    if (actor.kind === "user") assertTrustedOrigin(c);
    c.set("actor", actor);
    await next();
  };

/** Usuario de la petición (tras `requireUser`). */
export function currentUser(c: Context<AppEnv>): SessionUser {
  const user = c.get("user");
  if (!user) throw new AppError(401, "unauthorized", "Inicia sesión para continuar");
  return user;
}

/** Quién actúa (tras `requireStaff`). */
export function currentActor(c: Context<AppEnv>): Actor {
  const actor = c.get("actor");
  if (!actor) throw new AppError(401, "unauthorized", "Inicia sesión para continuar");
  return actor;
}

/** Exige un rol MAYOR al de la ruta base, para operaciones puntuales más sensibles (p. ej. cambiar roles). */
export function assertRole(c: Context<AppEnv>, minimum: Role) {
  if (!hasRole(actorRole(currentActor(c)), minimum)) {
    throw new AppError(403, "forbidden", "No tienes permisos para esto");
  }
}

/** CORS con cookies: sólo desde la web. */
export const credentialedCors: MiddlewareHandler<AppEnv> = (c, next) =>
  cors({
    origin: c.env.WEB_ORIGIN,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["content-type"],
    maxAge: 600,
  })(c, next);
