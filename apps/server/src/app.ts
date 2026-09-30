import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "@/env";
import { catalogRoutes } from "@/features/catalog/catalog.routes";
import { ingestionAdminRoutes } from "@/features/ingestion/ingestion.routes";
import { matchingAdminRoutes } from "@/features/matching/matching.routes";
import { createDb, type Db } from "@/shared/db/client";
import { handleError, notFound } from "@/shared/http/errors";
import { rateLimit, requireAdmin } from "@/shared/http/middleware";

export type AppEnv = {
  Bindings: Env;
  Variables: { db: Db };
};

/**
 * Composición HTTP. Cada feature expone su router; aquí sólo se montan y se
 * aplican las políticas transversales (errores, CORS, auth, rate limit).
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  app.use("*", async (c, next) => {
    c.set("db", createDb(c.env.DB));
    await next();
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  const publicApi = new Hono<AppEnv>();
  publicApi.use("*", cors({ origin: "*", allowMethods: ["GET"] }));
  publicApi.use("*", rateLimit);
  publicApi.route("/", catalogRoutes);

  const adminApi = new Hono<AppEnv>();
  adminApi.use("*", requireAdmin);
  adminApi.route("/", ingestionAdminRoutes);
  adminApi.route("/", matchingAdminRoutes);

  app.route("/v1/admin", adminApi);
  app.route("/v1", publicApi);

  app.notFound(notFound);
  app.onError(handleError);
  return app;
}
