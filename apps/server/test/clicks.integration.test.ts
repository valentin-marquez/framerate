import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { seedCatalog, testEnv } from "./helpers";

/** Clics salientes: la tienda sale del listing o del slug, van a Analytics Engine y lo inválido no se escribe. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
let seed: Awaited<ReturnType<typeof seedCatalog>>;
let points: AnalyticsEngineDataPoint[];

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
});
afterAll(() => dispose());
beforeEach(async () => {
  await resetD1(d1);
  seed = await seedCatalog(db);
  points = [];
  env.ANALYTICS = { writeDataPoint: (p) => p && points.push(p) };
});

async function post(body: unknown) {
  const headers = new Headers({ "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" });
  return app.request(
    "/v1/clicks",
    { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) },
    env,
  );
}
const url = "https://tienda.cl/p/1?utm_source=framerate.cl";

describe("POST /v1/clicks", () => {
  test("con listing escribe su tienda y producto en Analytics Engine, no en D1", async () => {
    const res = await post({
      source: "product_details_hero",
      target_url: url,
      referrer_path: "/producto/asus",
      listing_id: String(seed.listings.l1),
      product_id: "999",
    });
    expect(res.status).toBe(204);
    expect(points).toEqual([
      {
        indexes: [String(seed.alfa)],
        blobs: ["click", "product_details_hero", "/producto/asus"],
        doubles: [seed.alfa, seed.listings.l1, seed.asus],
      },
    ]);
    expect(await db.query.selectFrom("outbound_clicks").selectAll().execute()).toHaveLength(0);
  });

  test("en la página de una tienda la identifica por slug o por id", async () => {
    expect((await post({ source: "store_page", target_url: url, store_id: "beta" })).status).toBe(204);
    expect((await post({ source: "store_page", target_url: url, store_id: String(seed.alfa) })).status).toBe(204);
    expect(points.map((p) => p.doubles)).toEqual([
      [seed.beta, 0, 0],
      [seed.alfa, 0, 0],
    ]);
  });

  test("sin poder saber la tienda responde 404 y no escribe nada", async () => {
    for (const ref of [{ listing_id: "99999" }, { store_id: "no-existe" }, {}]) {
      const res = await post({ source: "store_page", target_url: url, ...ref });
      expect(res.status).toBe(404);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("store_not_found");
    }
    expect(points).toHaveLength(0);
  });

  test("rechaza un source desconocido, una URL inválida y un cuerpo que no es JSON", async () => {
    for (const body of [
      { source: "otro", target_url: url, store_id: "alfa" },
      { source: "store_page", target_url: "no es una url", store_id: "alfa" },
      "{",
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("invalid_request");
    }
    expect(points).toHaveLength(0);
  });

  test("rechaza un cuerpo de más de 4 KB", async () => {
    const res = await post({
      source: "store_page",
      target_url: url,
      store_id: "alfa",
      referrer_path: "x".repeat(5000),
    });
    expect(res.status).toBe(413);
    expect(points).toHaveLength(0);
  });
});
