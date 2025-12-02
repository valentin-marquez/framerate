import { findAvailablePort } from "@framerate/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { Logger } from "@/lib/logger";
import { routes } from "@/routes";

const logger = new Logger("System");
const app = new Hono();

app.use("*", cors());
app.use("*", honoLogger(logger.http));
app.use("*", prettyJSON());

logger.info("Iniciando el servicio de scraper...");

app.get("/", (c) => {
  return c.json({
    name: "framerate-scraper",
    message: "El servicio de scraper está en funcionamiento.",
    version: Bun.env.npm_package_version || "unknown",
  });
});

// Health check para Coolify
app.get("/health", (c) => {
  return c.text("OK");
});

// Registrar rutas
for (const route of routes) {
  app.route(route.path, route.route);
}

app.notFound((c) => {
  return c.json({ message: "No encontrado" }, 404);
});

logger.info("Servicio de scraper iniciado.");

export default {
  fetch: app.fetch,
  idleTimeout: 255, // Máximo permitido por Bun es 255 segundos
  port: await findAvailablePort(3001),
};
