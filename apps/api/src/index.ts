import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings, Variables } from "@/bindings";
import { rateLimitMiddleware } from "@/middleware/rate-limit";
import { routes } from "@/routes";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const logger = new Logger("API");

// Montar la ruta de imágenes ANTES del middleware global para evitar conflictos con secureHeaders/CORS
// Las imágenes manejan sus propios encabezados de CORS y Cache de manera extensiva
import images from "@/routes/images";

app.route("/v1/images", images);

app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: ["https://framerate.cl", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
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

app.use("/v1/products/search/*", rateLimitMiddleware("search"));

// Endpoints computacionalmente costosos (10 req/60s)
app.use("/v1/quotes/analyze", rateLimitMiddleware("strict"));
app.use("/v1/quotes/*/analyze", rateLimitMiddleware("strict"));

// Tracking y escritura (30 req/60s)
app.use("/v1/products/*/view", rateLimitMiddleware("moderate"));
app.use("/v1/quotes", rateLimitMiddleware("moderate"));
app.use("/v1/profiles/me", rateLimitMiddleware("moderate"));

// Lectura pública (100 req/60s)
app.use("/v1/products/*", rateLimitMiddleware("lenient"));
app.use("/v1/categories/*", rateLimitMiddleware("lenient"));
app.use("/v1/profiles/*", rateLimitMiddleware("lenient"));
app.use("/v1/auth/*", rateLimitMiddleware("lenient"));

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
