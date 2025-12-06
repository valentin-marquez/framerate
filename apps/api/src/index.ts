import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings, Variables } from "./bindings";
import { Logger } from "./lib/logger";
import { createApiRateLimiter } from "./middleware/rate-limit";
import { routes } from "./routes";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const logger = new Logger("API");

// Middleware
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: ["https://framerate.cl", "http://localhost:5173"],
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

const rateLimiter = createApiRateLimiter();
app.use("/*/products/*", rateLimiter);
app.use("/*/categories/*", rateLimiter);
app.use("/*/auth/*", rateLimiter);

// Routes
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
