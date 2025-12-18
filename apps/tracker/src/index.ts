import { Logger } from "@framerate/utils";
import { Elysia } from "elysia";
import { trackRoutes } from "@/routes/track";

const logger = new Logger("Tracker");

const app = new Elysia()
  .get("/", () => ({
    service: "🦊 Framerate Tracker Service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      trackBatch: "POST /track/batch",
    },
  }))

  .get("/health", () => ({
    status: "OK",
    service: "tracker",
    timestamp: new Date().toISOString(),
  }))

  // Register track routes
  .use(trackRoutes)

  .listen(3000);

logger.info(`El servicio Tracker está ejecutándose en ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
