import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "@/app";
import { AppError } from "./errors";

/**
 * Comparación en tiempo constante (hash + XOR) para no filtrar un secreto por timing.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= (va[i] ?? 0) ^ (vb[i] ?? 0);
  return diff === 0;
}

/** Límite de requests por IP en rutas públicas (binding de Rate Limiting de Workers). */
export const rateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const limiter = c.env.PUBLIC_RATE_LIMITER;
  if (limiter) {
    // Las llamadas del SSR de la web llegan por service binding, sin `cf-connecting-ip`: la web reenvía la IP del
    // visitante en `x-client-ip`. Una petición pública siempre trae `cf-connecting-ip` (lo pone Cloudflare), así
    // que nadie puede usar `x-client-ip` para esquivar el límite.
    const key = c.req.header("cf-connecting-ip") ?? c.req.header("x-client-ip") ?? "anonymous";
    const { success } = await limiter.limit({ key });
    if (!success) throw new AppError(429, "rate_limited", "Demasiadas solicitudes, intenta en un minuto");
  }
  await next();
};

/**
 * Caché en el edge (Cache API) para GET públicos. Sólo cachea respuestas 200.
 * En tests / entornos sin `caches` simplemente no hace nada.
 */
export function edgeCache(maxAgeSeconds: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const cache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
    if (!cache || c.req.method !== "GET") return next();

    const key = new Request(c.req.url, { method: "GET" });
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, hit);

    await next();
    if (c.res.status === 200) {
      c.res.headers.set("Cache-Control", `public, max-age=${maxAgeSeconds}`);
      c.executionCtx.waitUntil(cache.put(key, c.res.clone()));
    }
  };
}
