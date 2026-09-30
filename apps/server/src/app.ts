import { createDb, type Db } from "@framerate/database";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "@/env";
import { catalogRoutes } from "@/features/catalog/catalog.routes";
import { crawlAdminRoutes } from "@/features/crawl-admin/crawl-admin.routes";
import { getAuth } from "@/features/identity/auth";
import { authProvidersRoutes, meRoutes, publicProfileRoutes } from "@/features/identity/identity.routes";
import { credentialedCors, requireStaff, requireUser } from "@/features/identity/middleware";
import type { Actor, SessionUser } from "@/features/identity/types";
import { matchReviewRoutes } from "@/features/match-review/match-review.routes";
import { usersAdminRoutes } from "@/features/users-admin/users-admin.routes";
import { handleError, notFound } from "@/shared/http/errors";
import { rateLimit } from "@/shared/http/middleware";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
    /** Presente tras `requireUser`. */
    user?: SessionUser;
    /** Presente tras `requireStaff`. */
    actor?: Actor;
  };
};

/**
 * Composición HTTP. Cada feature expone su router; aquí sólo se montan y se
 * aplican las políticas transversales (errores, CORS, auth, rate limit).
 *
 *   /v1/auth/*    login/logout (Better Auth) + lista de proveedores. CORS con cookies sólo desde la web.
 *   /v1/me        perfil propio (requiere sesión).
 *   /v1/*         lectura pública (catálogo, perfiles públicos), con caché en el edge.
 *   /v1/admin/*   personal: moderador o superior (sesión), o el token de servicio.
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  app.use("*", async (c, next) => {
    c.set("db", createDb(c.env.DB));
    await next();
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  const authApi = new Hono<AppEnv>();
  authApi.use("*", credentialedCors);
  authApi.use("*", rateLimit);
  authApi.route("/", authProvidersRoutes);
  // Todo lo demás lo resuelve Better Auth (sign-in/social, callback/:provider, sign-out, get-session…).
  authApi.on(["GET", "POST"], "/*", (c) => getAuth(c.env).handler(c.req.raw));

  const meApi = new Hono<AppEnv>();
  meApi.use("*", credentialedCors);
  meApi.use("*", rateLimit);
  meApi.use("*", requireUser);
  meApi.route("/", meRoutes);

  const publicApi = new Hono<AppEnv>();
  publicApi.use("*", cors({ origin: "*", allowMethods: ["GET"] }));
  publicApi.use("*", rateLimit);
  publicApi.route("/", catalogRoutes);
  publicApi.route("/users", publicProfileRoutes);

  const adminApi = new Hono<AppEnv>();
  adminApi.use("*", requireStaff("moderator"));
  adminApi.route("/", crawlAdminRoutes);
  adminApi.route("/", matchReviewRoutes);
  adminApi.route("/users", usersAdminRoutes);

  app.route("/v1/auth", authApi);
  app.route("/v1/me", meApi);
  app.route("/v1/admin", adminApi);
  app.route("/v1", publicApi);

  app.notFound(notFound);
  app.onError(handleError);
  return app;
}
