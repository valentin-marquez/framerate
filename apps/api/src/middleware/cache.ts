import type { MiddlewareHandler } from "hono";
import { cache as honoCache } from "hono/cache";

/**
 * Envoltura alrededor de hono/cache que solo habilita el almacenamiento en caché
 * si la API de Cache está disponible. Esto previene las advertencias
 * "Cache Middleware is not enabled because caches is not defined"
 * durante el desarrollo local con Bun.
 */
export const cache = (options: { cacheName: string; cacheControl: string; wait?: boolean }): MiddlewareHandler => {
  // Verifica si la API de Cache está disponible (Cloudflare Workers)
  if (typeof caches !== "undefined") {
    return honoCache(options);
  }

  // si no está disponible, devuelve un middleware vacío
  return async (_c, next) => {
    await next();
  };
};
