import { Logger } from "@framerate/utils";
import { createMiddleware } from "hono/factory";
import type { Bindings, Variables } from "@/bindings";

const logger = new Logger("RateLimit");

type RateLimiterType = "strict" | "moderate" | "lenient" | "search";

/**
 * Middleware de rate limiting que se aplica per-handler. Debe ir DESPUÉS de
 * `Cache(...)` cuando ambos existen, así un cache HIT no consume cuota.
 *
 * @example
 * ```typescript
 * products.get("/", Cache({ ... }), Limit("lenient"), handler);
 * quotes.post("/analyze", Limit("strict"), handler);
 * ```
 */
export const Limit = (type: RateLimiterType) => {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const limiterMap = {
      strict: c.env.STRICT_RATE_LIMITER,
      moderate: c.env.MODERATE_RATE_LIMITER,
      lenient: c.env.LENIENT_RATE_LIMITER,
      search: c.env.SEARCH_RATE_LIMITER,
    };

    const limiter = limiterMap[type];

    if (!limiter) {
      logger.error(`Rate limiter type "${type}" not found`);
      return c.json({ error: "Internal server error" }, 500);
    }

    // Importante: este middleware se aplica DESPUÉS de `Cache(...)` en cada
    // handler. Si hay cache HIT, `honoCache` short-circuita la cadena y este
    // middleware NUNCA se ejecuta, por lo que las respuestas servidas desde
    // cache no consumen cuota.

    // Usar user ID para requests autenticados, IP para públicos.
    // En dev local (`wrangler dev`) no existe `cf-connecting-ip`, por lo que TODOS
    // los anónimos compartirían la misma cuota global ("unknown"). Para evitarlo,
    // usamos un identificador aleatorio por request cuando no hay IP — esto deja
    // el binding caliente y mantiene la ruta idéntica, pero hace cada llamada
    // independiente. En producción, `cf-connecting-ip` siempre está presente.
    const user = c.get("user");
    const cfIp = c.req.header("cf-connecting-ip");
    const identifier = user?.id || cfIp || `dev-${crypto.randomUUID()}`;

    const { success } = await limiter.limit({ key: identifier });

    if (!success) {
      logger.warn(`Rate limit exceeded for ${identifier} on ${c.req.path} (${type})`);
      return c.json(
        {
          error: "Límite de solicitudes excedido",
          message: "Demasiadas solicitudes. Por favor, inténtelo de nuevo más tarde.",
        },
        429,
      );
    }

    await next();
  });
};
