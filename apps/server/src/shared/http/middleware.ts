import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "@/app";
import { AppError } from "./errors";

/**
 * Protege `/v1/admin/*` con un token Bearer (secreto `ADMIN_TOKEN`).
 * Comparación en tiempo constante para no filtrar el token por timing.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const expected = c.env.ADMIN_TOKEN;
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !(await timingSafeEqual(token, expected))) {
    throw new AppError(401, "unauthorized", "Token de administrador inválido");
  }
  await next();
};

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
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
    const key = c.req.header("cf-connecting-ip") ?? "anonymous";
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
