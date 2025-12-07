import { Logger } from "@framerate/utils";
import { Elysia } from "elysia";
import { config } from "./config";
import { trackRoutes } from "./routes/track";

const logger = new Logger("Tracker");

const app = new Elysia()
  .use(trackRoutes)
  .get("/health", () => ({ status: "ok" }))
  .listen(config.PORT);

logger.info(`🦊 Tracker Service is running at ${app.server?.hostname}:${app.server?.port}`);
