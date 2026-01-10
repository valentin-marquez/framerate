import { Logger } from "@framerate/utils";
import { createMiddleware } from "hono/factory";
import type { Bindings, Variables } from "@/bindings";

const logger = new Logger("RateLimit");

type RateLimiterType = "strict" | "moderate" | "lenient" | "search";

/**
 * Middleware de rate limiting que se puede aplicar a rutas específicas
 *
 * @example
 * ```typescript
 * app.use("/v1/products/*", Limit("lenient"));
 * app.use("/v1/quotes/analyze", Limit("strict"));
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

    // Usar user ID para requests autenticados, IP para públicos
    const user = c.get("user");
    const identifier = user?.id || c.req.header("cf-connecting-ip") || "unknown";

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
