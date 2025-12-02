import { WorkersKVStore } from "@hono-rate-limiter/cloudflare";
import type { Context, Next } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import type { Bindings, Variables } from "../bindings";
import { Logger } from "../lib/logger";

const logger = new Logger("RateLimit");

type AppEnv = { Bindings: Bindings; Variables: Variables };

/**
 * Crea un middleware de limitación de tasa utilizando Cloudflare WorkersKV.
 * Debe ser llamado dentro de un manejador de solicitudes para acceder a los bindings.
 */
export function createApiRateLimiter() {
  return (c: Context<AppEnv>, next: Next) =>
    rateLimiter<AppEnv>({
      windowMs: 15 * 60 * 1000, // 15 minutes el calculo es: 15 minutos * 60 segundos * 1000 milisegundos
      limit: 100, // limitar a 100 solicitudes por ventana por IP
      standardHeaders: "draft-6",
      keyGenerator: (c) => c.req.header("cf-connecting-ip") ?? "unknown",
      store: new WorkersKVStore({ namespace: c.env.RATE_LIMIT_KV as KVNamespace }),
      handler: (c: Context) => {
        const ip = c.req.header("cf-connecting-ip") ?? "unknown";
        logger.warn(`Rate limit exceeded for IP: ${ip}`);
        return c.json({ error: "Too many requests, please try again later." }, 429);
      },
    })(c, next);
}
