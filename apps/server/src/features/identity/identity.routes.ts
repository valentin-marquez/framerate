import { RESERVED_USERNAMES, UpdateProfileSchema } from "@framerate/contracts";
import { Hono } from "hono";
import type { AppEnv } from "@/app";
import { AppError } from "@/shared/http/errors";
import { edgeCache } from "@/shared/http/middleware";
import { toMe, toPublicProfile } from "./identity.mappers";
import { findUserById, findUserByUsername, updateProfile } from "./identity.repository";
import { currentUser } from "./middleware";
import { enabledProviders } from "./providers";

/** `GET /v1/auth/providers` — proveedores de login disponibles en este despliegue (la web dibuja sus botones con esto). */
export const authProvidersRoutes = new Hono<AppEnv>().get("/providers", (c) =>
  c.json({ items: enabledProviders(c.env).map(({ id, label }) => ({ id, label })) }),
);

/** `/v1/me` — perfil propio. Requiere sesión (el middleware se aplica al montar). */
export const meRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const session = currentUser(c);
    const user = await findUserById(c.var.db, session.id);
    if (!user) throw new AppError(401, "unauthorized", "Inicia sesión para continuar");
    return c.json(toMe(user, session.ban, c.env.ASSETS_BASE_URL));
  })
  .patch("/", async (c) => {
    const session = currentUser(c);
    // El esquema es estricto: avatar, correo y rol no se aceptan (no son del usuario).
    const changes = UpdateProfileSchema.parse(await c.req.json().catch(() => ({})));

    if (changes.username !== undefined && RESERVED_USERNAMES.has(changes.username)) {
      throw new AppError(409, "username_reserved", "Ese nombre de usuario no está disponible");
    }
    const result = await updateProfile(c.var.db, session.id, changes, new Date().toISOString());
    if (result === "username_taken") {
      throw new AppError(409, "username_taken", "Ese nombre de usuario ya está en uso");
    }

    const user = await findUserById(c.var.db, session.id);
    if (!user) throw new AppError(401, "unauthorized", "Inicia sesión para continuar");
    return c.json(toMe(user, session.ban, c.env.ASSETS_BASE_URL));
  });

/** `GET /v1/users/:username` — perfil público (sin correo, rol ni sanciones). */
export const publicProfileRoutes = new Hono<AppEnv>().get("/:username", edgeCache(60), async (c) => {
  const user = await findUserByUsername(c.var.db, c.req.param("username"));
  if (!user) throw new AppError(404, "user_not_found", "Usuario no encontrado");
  return c.json(toPublicProfile(user, c.env.ASSETS_BASE_URL));
});
