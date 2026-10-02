import { createDb, type Db } from "@framerate/database";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "@/env";
import { catalogRoutes } from "@/features/catalog/catalog.routes";
import { claimsRoutes } from "@/features/claims/claims.routes";
import { claimsAdminRoutes } from "@/features/claims/claims-admin.routes";
import { commentsRoutes, productCommentsRoutes } from "@/features/comments/comments.routes";
import { crawlAdminRoutes } from "@/features/crawl-admin/crawl-admin.routes";
import { healthRoutes } from "@/features/health/health.routes";
import { getAuth } from "@/features/identity/auth-instance";
import type { UserRow } from "@/features/identity/identity.repository";
import { authProvidersRoutes, meRoutes, publicProfileRoutes } from "@/features/identity/identity.routes";
import { mergeRoutes } from "@/features/identity/merge.routes";
import { credentialedCors, optionalUser, requireStaff, requireUser } from "@/features/identity/middleware";
import type { Actor, SessionUser } from "@/features/identity/types";
import { matchReviewRoutes } from "@/features/match-review/match-review.routes";
import { quotesRoutes } from "@/features/quotes/quotes.routes";
import { myStoresRoutes } from "@/features/stores/my-stores.routes";
import { storeManagementRoutes } from "@/features/stores/store-management.routes";
import { storesRoutes } from "@/features/stores/stores.routes";
import { supportRoutes } from "@/features/support/support.routes";
import { supportAdminRoutes } from "@/features/support/support-admin.routes";
import { usersAdminRoutes } from "@/features/users-admin/users-admin.routes";
import { handleError, notFound } from "@/shared/http/errors";
import { rateLimit } from "@/shared/http/middleware";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
    /** Presente tras `requireUser`. */
    user?: SessionUser;
    /** Fila del usuario que `requireUser` ya leyó, para no pedirla de nuevo. */
    userRow?: UserRow;
    /** Presente tras `requireStaff`. */
    actor?: Actor;
  };
};

/**
 * Composición HTTP. Cada feature expone su router; aquí sólo se montan y se
 * aplican las políticas transversales (errores, CORS, auth, rate limit).
 *
 *   /v1/auth/*    login/logout (Better Auth) + lista de proveedores. CORS con cookies sólo desde la web.
 *   /v1/me        perfil propio y unión de usuarios (`/v1/me/merge`). Requiere sesión.
 *   /v1/support   tickets de soporte: con sesión, o sin cuenta con Turnstile y el token del ticket.
 *   /v1/quotes    cotizaciones: las ajenas se leen según su visibilidad; escribir exige ser el dueño.
 *   /v1/*         lectura pública (catálogo, perfiles públicos), con caché en el edge.
 *   /v1/admin/*   personal: moderador o superior (sesión), o el token de servicio.
 *
 * Todo CORS es sólo para el origen de la web y con cookies: el navegador envía la sesión en cada llamada y no
 * la acepta junto a `Access-Control-Allow-Origin: *`.
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  // Server-Timing: cuánto del request fue D1 (la primaria está lejos de Chile). En el navegador sale en la pestaña Red.
  app.use("*", async (c, next) => {
    const start = Date.now();
    let queries = 0;
    let d1Ms = 0;
    c.set(
      "db",
      createDb(c.env.DB, (ms) => {
        queries++;
        d1Ms += ms;
      }),
    );
    await next();
    c.res.headers.append(
      "Server-Timing",
      `d1;dur=${Math.round(d1Ms)};desc="${queries} viajes", app;dur=${Date.now() - start}`,
    );
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  // El proxy de imágenes del sistema anterior ya no existe, pero buscadores y cachés lo siguen pidiendo.
  app.get("/v1/images/*", (c) => c.redirect(`${c.env.WEB_ORIGIN}/og-image.png`, 301));

  const authApi = new Hono<AppEnv>();
  authApi.use("*", credentialedCors);
  authApi.use("*", rateLimit);
  authApi.route("/", authProvidersRoutes);
  // Todo lo demás lo resuelve Better Auth (sign-in/social, callback/:provider, sign-out, get-session…).
  authApi.on(["GET", "POST"], "/*", async (c) => (await getAuth(c.env)).handler(c.req.raw));

  const meApi = new Hono<AppEnv>();
  meApi.use("*", credentialedCors);
  meApi.use("*", rateLimit);
  meApi.use("*", requireUser);
  meApi.route("/merge", mergeRoutes);
  meApi.route("/stores", myStoresRoutes);
  meApi.route("/", meRoutes);

  const claimsApi = new Hono<AppEnv>();
  claimsApi.use("*", credentialedCors);
  claimsApi.use("*", rateLimit);
  claimsApi.use("*", requireUser);
  claimsApi.route("/", claimsRoutes);

  const supportApi = new Hono<AppEnv>();
  supportApi.use("*", credentialedCors);
  supportApi.use("*", rateLimit);
  supportApi.use("*", optionalUser);
  supportApi.route("/", supportRoutes);

  const quotesApi = new Hono<AppEnv>();
  quotesApi.use("*", credentialedCors);
  quotesApi.use("*", rateLimit);
  quotesApi.use("*", optionalUser);
  quotesApi.route("/", quotesRoutes);

  const productCommentsApi = new Hono<AppEnv>();
  productCommentsApi.use("*", credentialedCors);
  productCommentsApi.use("*", rateLimit);
  productCommentsApi.use("*", optionalUser);
  productCommentsApi.route("/", productCommentsRoutes);

  const commentsApi = new Hono<AppEnv>();
  commentsApi.use("*", credentialedCors);
  commentsApi.use("*", rateLimit);
  commentsApi.use("*", optionalUser);
  commentsApi.route("/", commentsRoutes);

  const publicApi = new Hono<AppEnv>();
  publicApi.use("*", credentialedCors);
  publicApi.use("*", rateLimit);
  publicApi.route("/", catalogRoutes);
  publicApi.route("/", storesRoutes);
  publicApi.route("/", storeManagementRoutes);
  publicApi.route("/users", publicProfileRoutes);

  const adminApi = new Hono<AppEnv>();
  adminApi.use("*", credentialedCors);
  adminApi.use("*", requireStaff("moderator"));
  adminApi.route("/", crawlAdminRoutes);
  adminApi.route("/", healthRoutes);
  adminApi.route("/", matchReviewRoutes);
  adminApi.route("/", claimsAdminRoutes);
  adminApi.route("/support", supportAdminRoutes);
  adminApi.route("/users", usersAdminRoutes);

  app.route("/v1/auth", authApi);
  app.route("/v1/me", meApi);
  app.route("/v1/claims", claimsApi);
  app.route("/v1/support", supportApi);
  app.route("/v1/quotes", quotesApi);
  app.route("/v1/comments", commentsApi);
  app.route("/v1/products/:id/comments", productCommentsApi);
  app.route("/v1/admin", adminApi);
  app.route("/v1", publicApi);

  app.notFound(notFound);
  app.onError(handleError);
  return app;
}
