import { describe, expect, test } from "bun:test";
import { createTestD1 } from "@framerate/database/testing";
import { Hono } from "hono";
import type { AppEnv } from "@/app";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { handleError } from "@/shared/http/errors";
import { rateLimit } from "@/shared/http/middleware";
import { testEnv } from "./helpers";

/** Cada visitante debe tener su propio cupo, también cuando el SSR de la web llama por service binding. */

function appWithLimiter() {
  const keys: string[] = [];
  const app = new Hono<AppEnv>();
  app.use("*", rateLimit);
  app.get("/", (c) => c.text("ok"));
  app.onError(handleError);
  const env = {
    PUBLIC_RATE_LIMITER: {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: key !== "bloqueada" };
      },
    },
  };
  return { keys, request: (headers: Record<string, string>) => app.request("/", { headers }, env) };
}

describe("clave del límite", () => {
  test("usa la IP de Cloudflare cuando es una petición pública", async () => {
    const { keys, request } = appWithLimiter();
    await request({ "cf-connecting-ip": "1.1.1.1" });
    expect(keys).toEqual(["1.1.1.1"]);
  });

  test("por service binding usa la IP que reenvía la web", async () => {
    const { keys, request } = appWithLimiter();
    await request({ "x-client-ip": "2.2.2.2" });
    expect(keys).toEqual(["2.2.2.2"]);
  });

  test("una IP declarada por el cliente no pisa la de Cloudflare", async () => {
    const { keys, request } = appWithLimiter();
    await request({ "cf-connecting-ip": "1.1.1.1", "x-client-ip": "9.9.9.9" });
    expect(keys).toEqual(["1.1.1.1"]);
  });

  test("responde 429 al pasarse del cupo", async () => {
    const { request } = appWithLimiter();
    expect((await request({ "cf-connecting-ip": "bloqueada" })).status).toBe(429);
  });
});

describe("rutas con límite", () => {
  // #195: el catálogo sale de la caché del edge y el SSR hace varias llamadas por página; lo que escribe sigue con cupo.
  test("el catálogo no gasta cupo y las tiendas sí", async () => {
    const { d1, dispose } = await createTestD1();
    const keys: string[] = [];
    const { env } = testEnv(
      d1,
      {},
      {
        PUBLIC_RATE_LIMITER: {
          limit: async ({ key }: { key: string }) => {
            keys.push(key);
            return { success: true };
          },
        } as unknown as Env["PUBLIC_RATE_LIMITER"],
      },
    );
    const app = createApp();
    const headers = { "cf-connecting-ip": "1.1.1.1" };
    await app.request("/v1/categories", { headers }, env);
    await app.request("/v1/products/redirects/nada", { headers }, env);
    expect(keys).toEqual([]);
    await app.request("/v1/stores/alfa", { headers }, env);
    expect(keys).toEqual(["1.1.1.1"]);
    await dispose();
  });
});
