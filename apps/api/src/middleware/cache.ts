import { Logger } from "@framerate/utils";
import type { Context } from "hono";
import { cache as honoCache } from "hono/cache";
import { createMiddleware } from "hono/factory";
import type { Bindings, Variables } from "@/bindings";

const logger = new Logger("Cache");

/**
 * Tiempos de vida (TTL) estandarizados en segundos.
 * Usa estas constantes para mantener consistencia en toda la app.
 */
export const CACHE_TTL = {
  SEARCH: 60, // 1 min (Búsquedas frecuentes)
  QUICK_SEARCH: 30, // 30 seg (Live search)
  SHORT: 300, // 5 min (Listas, precios volátiles, quotes)
  MEDIUM: 600, // 10 min (Perfiles)
  LONG: 3600, // 1 hora (Detalles de producto, categorías estáticas)
  STATIC: 31536000, // 1 año (Assets inmutables)
} as const;

type CacheMode = "public" | "private";

interface CacheOptions {
  /**
   * Define la estrategia de cache:
   * - `public`: Para datos compartidos (CDN/Browser). Ignora usuarios.
   * - `private`: Para datos sensibles/personales. Genera keys únicas por User ID.
   */
  mode: CacheMode;
  /**
   * Tiempo de vida en segundos. Preferiblemente usa CACHE_TTL.
   */
  ttl: number;
  /**
   * Nombre del namespace para el cache (ej: "product-detail", "user-quotes").
   */
  name: string;
  /**
   * Si es true, espera a que el cache se escriba antes de responder (lento).
   * Default: false (rápido, fire-and-forget).
   */
  wait?: boolean;
}

/**
 * Middleware unificado de Cache.
 * Aplica automáticamente las reglas de seguridad y generación de keys.
 * * @example
 * app.get("/products", Cache({ mode: "public", ttl: CACHE_TTL.SHORT, name: "products-list" }))
 * app.get("/quotes", Cache({ mode: "private", ttl: CACHE_TTL.SHORT, name: "user-quotes" }))
 */
export const Cache = ({ mode, ttl, name, wait = false }: CacheOptions) => {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    logger.info(`Cache middleware invoked for ${c.req.url}`);

    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      logger.info(`Skipping cache for method: ${c.req.method}`);
      return next();
    }

    if (typeof caches === "undefined") {
      logger.warn("Caching is not supported in this environment.");
      return next();
    }

    // 3. Configuración de estrategia (Strategy Pattern)
    let cacheControl = `public, max-age=${ttl}`;
    // biome-ignore lint/suspicious/noImplicitAnyLet: Key generator variable
    let keyGenerator;

    if (mode === "private") {
      // Estrategia Privada: Header private + Key única por usuario
      cacheControl = `private, max-age=${ttl}`;

      keyGenerator = (ctx: Context) => {
        const user = ctx.get("user");
        const userId = user?.id || "anon";

        logger.info(`Generated private cache key for user: ${userId}`);
        return `${ctx.req.url}:${userId}`;
      };
    } else {
      logger.info("Using public cache strategy.");
      // Estrategia Pública: Default de Hono (URL como key)
      // Solo aseguramos que la URL sea absoluta o consistente si es necesario,
      // pero hono/cache maneja bien el default.
    }

    logger.info(`Applying cache with name: ${name}, mode: ${mode}, ttl: ${ttl}`);

    return honoCache({
      cacheName: name,
      cacheControl,
      keyGenerator,
      wait,
    })(c, next);
  });
};

/**
 * Utilidad para invalidar caché manualmente después de mutaciones.
 * @example await invalidateCache(c, "/v1/quotes");
 */
export const invalidateCache = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, pathOrUrl: string) => {
  if (typeof caches === "undefined") {
    logger.warn("Caching is not supported in this environment.");
    return;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Acceso global a caches
  const cache = (caches as any).default;

  const url = pathOrUrl.startsWith("http") ? pathOrUrl : new URL(pathOrUrl, c.req.url).toString();

  logger.info(`Invalidating cache for URL: ${url}`);

  // Ejecución asíncrona (non-blocking) para no demorar la respuesta al cliente
  c.executionCtx.waitUntil(cache.delete(url));
};
