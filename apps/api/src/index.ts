import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings, Variables } from "@/bindings";
import { Limit } from "@/middleware/rate-limit";
import { routes } from "@/routes";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const logger = new Logger("API");

// Montar la ruta de imágenes ANTES del middleware global para evitar conflictos con secureHeaders/CORS
// Las imágenes manejan sus propios encabezados de CORS y Cache de manera extensiva
import images from "@/routes/images";

app.route("/v1/images", images);

app.use("*", secureHeaders());
// Origins permitidos: producción + cualquier dev server local (incluyendo IPs de LAN
// 192.168.x.x / 10.x.x.x para testing en otros dispositivos de la red).
const ALLOWED_ORIGINS = ["https://framerate.cl"];
const LAN_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):(5173|3000|4173|8787)$/;

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      if (LAN_DEV_ORIGIN.test(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.http(`${c.req.method} ${c.req.path} - ${c.res.status} - ${ms}ms`);
});

app.use("/v1/products/search/*", Limit("search"));

// Endpoints computacionalmente costosos (10 req/60s)
app.use("/v1/quotes/analyze", Limit("strict"));
app.use("/v1/quotes/*/analyze", Limit("strict"));

// Tracking y escritura (30 req/60s)
app.use("/v1/products/*/view", Limit("moderate"));
app.use("/v1/quotes", Limit("moderate"));
app.use("/v1/profiles/me", Limit("moderate"));
app.use("/v1/translation-feedback", Limit("strict"));

// Fase 3: comments — escritura y votación con tier moderate.
app.use("/v1/products/*/comments", Limit("moderate"));
app.use("/v1/comments/*", Limit("moderate"));

// Fase 4: moderation
app.use("/v1/reports", Limit("moderate"));
app.use("/v1/reports/*", Limit("moderate"));
app.use("/v1/admin/moderation/*", Limit("moderate"));

// Lectura pública (100 req/60s)
app.use("/v1/products/*", Limit("lenient"));
app.use("/v1/categories/*", Limit("lenient"));
app.use("/v1/profiles/*", Limit("lenient"));
app.use("/v1/auth/*", Limit("lenient"));

// Fase 1: claims + stores
app.use("/v1/claims", Limit("strict"));
app.use("/v1/claims/*/verify", Limit("strict"));
app.use("/v1/claims/*/confirm", Limit("strict"));
app.use("/v1/claims/my", Limit("lenient"));
app.use("/v1/stores/*/members", Limit("moderate"));

// Fase 2: store-reviews (lectura lenient, escrituras moderate)
app.use("/v1/stores/*/reviews", Limit("lenient"));
app.use("/v1/stores/*/reviews/stats", Limit("lenient"));
app.use("/v1/reviews/*", Limit("moderate"));

// Fase 1 fallback para resto de /v1/stores (después de los de reviews para no shadow)
app.use("/v1/stores/*", Limit("moderate"));

app.get("/", (c) => {
  return c.json({
    message: "Welcome to Framerate API",
    version: "1.0.0",
  });
});

for (const route of routes) {
  app.route(route.path, route.route);
}

export default app;
