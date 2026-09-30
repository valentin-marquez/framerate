import type { MergePreview } from "@framerate/contracts";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "@/app";
import { AppError } from "@/shared/http/errors";
import { avatarUrl } from "./domain/avatar";
import { findUserById, type UserRow } from "./identity.repository";
import { cancelMerge, findPendingMerge, mergeCounts, mergeUsers, providersOf, startMerge } from "./merge.repository";
import { currentUser } from "./middleware";

/**
 * `/v1/me/merge`: unir otro usuario de Framerate al propio. A (el que se queda) inicia con su sesión y recibe
 * la cookie; luego entra con el proveedor del otro (sesión de B) y confirma. Así prueba ser dueño de ambos
 * sin que nadie tome la sesión del otro. Se monta bajo `requireUser` (sesión + Origin de la web).
 */

const COOKIE = "framerate.merge";
const TTL_S = 600;

const cookieOptions = (c: Context<AppEnv>) => ({
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "Lax" as const,
  ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }),
});

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

const tokenHashOf = async (c: Context<AppEnv>) => {
  const token = getCookie(c, COOKIE);
  return token ? sha256(token) : undefined;
};

/** La fusión de la cookie, lista para absorber al usuario de la sesión. */
async function pendingMerge(c: Context<AppEnv>) {
  const hash = await tokenHashOf(c);
  const merge = hash ? await findPendingMerge(c.var.db, hash) : undefined;
  if (!merge) throw new AppError(404, "merge_not_found", "No hay una unión de cuentas en curso");
  if (merge.expires_at <= new Date().toISOString()) {
    throw new AppError(410, "merge_expired", "La unión de cuentas venció; vuelve a empezar");
  }
  const survivor = await findUserById(c.var.db, merge.survivor_id);
  if (!survivor) throw new AppError(404, "merge_not_found", "No hay una unión de cuentas en curso");
  const me = currentUser(c);
  // Pasa si el proveedor ya era de A o se vinculó solo (mismo correo): no hay nada que unir.
  if (survivor.id === me.id) throw new AppError(409, "merge_same_user", "Esa cuenta ya es la tuya");
  const absorbed = await findUserById(c.var.db, me.id);
  if (!absorbed) throw new AppError(401, "unauthorized", "Inicia sesión para continuar");
  return { merge, survivor, absorbed };
}

export const mergeRoutes = new Hono<AppEnv>()
  .post("/start", async (c) => {
    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    const now = Date.now();
    await startMerge(
      c.var.db,
      currentUser(c).id,
      await sha256(token),
      new Date(now).toISOString(),
      new Date(now + TTL_S * 1000).toISOString(),
    );
    setCookie(c, COOKIE, token, { ...cookieOptions(c), maxAge: TTL_S });
    return c.body(null, 204);
  })

  .get("/", async (c) => {
    const { survivor, absorbed } = await pendingMerge(c);
    const side = async (user: UserRow) => ({
      username: user.username,
      displayName: user.display_name,
      avatarUrl: avatarUrl(user, c.env.ASSETS_BASE_URL),
      providers: await providersOf(c.var.db, user.id),
    });
    return c.json<MergePreview>({
      survivor: await side(survivor),
      absorbed: await side(absorbed),
      counts: await mergeCounts(c.var.db, absorbed.id),
    });
  })

  .post("/confirm", async (c) => {
    const { merge, survivor, absorbed } = await pendingMerge(c);
    // No se abre sesión de A: quien confirma vuelve a entrar con cualquiera de sus proveedores y cae en A.
    await mergeUsers(c.env.DB, {
      mergeId: merge.id,
      survivorId: survivor.id,
      absorbed,
      summary: { counts: await mergeCounts(c.var.db, absorbed.id), role: absorbed.role },
      now: new Date().toISOString(),
    });
    deleteCookie(c, COOKIE, cookieOptions(c));
    return c.body(null, 204);
  })

  .delete("/", async (c) => {
    const hash = await tokenHashOf(c);
    if (hash) await cancelMerge(c.var.db, hash);
    deleteCookie(c, COOKIE, cookieOptions(c));
    return c.body(null, 204);
  });
