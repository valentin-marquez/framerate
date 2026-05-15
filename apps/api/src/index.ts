import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings, Variables } from "@/bindings";
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

// Rate limiting se aplica per-handler dentro de cada route file. Esto permite
// que el middleware `Cache(...)` corra ANTES de `Limit(...)` y así un HIT de
// cache no consuma cuota. Ver `apps/api/src/middleware/{cache,rate-limit}.ts`.

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
