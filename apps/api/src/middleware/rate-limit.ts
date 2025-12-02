import type { Context, Next } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { Logger } from "../lib/logger";

const logger = new Logger("RateLimit");

// In Cloudflare Workers, we can use a simple in-memory store for rate limiting per isolate
// For distributed consistency, we would need KV or Durable Objects, but this is a good start
// to prevent massive abuse from a single connection.

export const apiRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  keyGenerator: (c: Context) => {
    // Cloudflare specific header for client IP
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    return ip;
  },
  handler: (c: Context, _next: Next) => {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    logger.warn(`Rate limit exceeded for IP: ${ip}`);
    return c.json({ error: "Too many requests, please try again later." }, 429);
  },
});
