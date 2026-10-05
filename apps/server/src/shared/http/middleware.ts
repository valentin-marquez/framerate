import { catalogVersion } from "@framerate/database";
import type { Context, MiddlewareHandler } from "hono";
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
 * Caché en el edge (Cache API) para GET públicos. Sólo cachea respuestas 200; `maxAgeSeconds` es lo que guarda el edge
 * y lo que se le dice al navegador. En tests / entornos sin `caches` simplemente no hace nada.
 */
export function edgeCache(maxAgeSeconds: number): MiddlewareHandler<AppEnv> {
  return cached(maxAgeSeconds, maxAgeSeconds, async (c) => c.req.url);
}

/** Lo que guarda el edge una respuesta del catálogo: una versión nueva la invalida antes. */
const CATALOG_EDGE_TTL = 6 * 3600;
const VERSION_MEMO_MS = 60_000;
let versionMemo: { version: number; readAt: number } | undefined;

/**
 * Como `edgeCache`, pero con `catalog_version` en la clave: el edge guarda horas y un precio nuevo se ve apenas termina
 * la corrida (más el minuto que cada isolate recuerda la versión). Al navegador le sigue diciendo `maxAgeSeconds`.
 */
export function catalogCache(maxAgeSeconds: number): MiddlewareHandler<AppEnv> {
  return cached(maxAgeSeconds, CATALOG_EDGE_TTL, async (c) => {
    const now = Date.now();
    if (!versionMemo || now - versionMemo.readAt > VERSION_MEMO_MS) {
      versionMemo = { version: await catalogVersion(c.var.db), readAt: now };
    }
    const url = new URL(c.req.url);
    url.searchParams.set("__v", String(versionMemo.version));
    return url.toString();
  });
}

function cached(
  browserMaxAge: number,
  edgeMaxAge: number,
  cacheKey: (c: Context<AppEnv>) => Promise<string>,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const cache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
    if (!cache || c.req.method !== "GET") return next();

    const key = new Request(await cacheKey(c), { method: "GET" });
    const hit = await cache.match(key);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set("Cache-Control", `public, max-age=${browserMaxAge}`);
      return res;
    }

    await next();
    if (c.res.status === 200) {
      const stored = c.res.clone();
      stored.headers.set("Cache-Control", `public, max-age=${edgeMaxAge}`);
      c.res.headers.set("Cache-Control", `public, max-age=${browserMaxAge}`);
      c.executionCtx.waitUntil(cache.put(key, stored));
    }
  };
}
