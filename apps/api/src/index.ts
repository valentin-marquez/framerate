import { findAvailablePort } from "@framerate/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings, Variables } from "./bindings";
import { Logger } from "./lib/logger";
import { apiRateLimiter } from "./middleware/rate-limit";
import { routes } from "./routes";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const logger = new Logger("API");

// Middleware
app.use("*", secureHeaders()); // Add security headers (X-XSS-Protection, etc.)
app.use(
  "*",
  cors({
    origin: ["https://framerate.cl", "http://localhost:3000"], // Restrict to your domains
    allowMethods: ["GET", "POST", "OPTIONS"],
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

// Apply Rate Limiting to public routes
// Note: We use a wildcard to match versioned routes
app.use("/*/products/*", apiRateLimiter);
app.use("/*/categories/*", apiRateLimiter);
app.use("/*/auth/*", apiRateLimiter);

// Routes
app.get("/", (c) => {
  return c.json({
    message: "Welcome to Framerate API",
    version: Bun.env.npm_package_version || "unknown",
  });
});

// Register routes dynamically
for (const route of routes) {
  app.route(route.path, route.route);
}

export default {
  fetch: app.fetch,
  port: await findAvailablePort(3000),
};
