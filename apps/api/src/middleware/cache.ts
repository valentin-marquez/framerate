import type { MiddlewareHandler } from "hono";
import { cache as honoCache } from "hono/cache";

/**
 * Wrapper around hono/cache that only enables caching if the Cache API is available.
 * This prevents "Cache Middleware is not enabled because caches is not defined" warnings
 * during local development with Bun.
 */
export const cache = (options: {
  cacheName: string;
  cacheControl: string;
  wait?: boolean;
}): MiddlewareHandler => {
  // Check if the Cache API is available (Cloudflare Workers)
  if (typeof caches !== "undefined") {
    return honoCache(options);
  }

  // If not available (e.g. local Bun), just proceed
  return async (_c, next) => {
    await next();
  };
};
