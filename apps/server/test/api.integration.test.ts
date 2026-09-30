import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ApiErrorSchema, PricePointSchema, ProductDetailSchema, ProductPageSchema } from "@framerate/contracts";
import { z } from "zod";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { crawlCategory } from "@/features/ingestion/crawl-category";
import { createTestD1, fakeStore, offer, steppingClock, testDeps, testEnv } from "./helpers";

/** API HTTP de punta a punta; las respuestas se validan contra `@framerate/contracts`. */

let d1: D1Database;
let dispose: () => Promise<void>;
let env: Env;
let sent: ReturnType<typeof testEnv>["sent"];
const app = createApp();
const get = (path: string, init?: RequestInit) => app.request(path, init, env);

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
  ({ env, sent } = testEnv(d1));

  const clock = steppingClock();
  const deps = testDeps(d1, clock);
  const alfa = fakeStore("alfa", { gpu: ["gpu"], cpu: ["cpu"] });
  const beta = fakeStore("beta", { gpu: ["gpu"] });
  alfa.setOffers([
    offer("alfa", "1", {
      category: "gpu",
      title: "ASUS Dual RTX 4070 SUPER OC 12GB",
      priceCash: 650_000,
      mpn: "DUAL-RTX4070S-O12G",
    }),
    offer("alfa", "2", { category: "gpu", title: "MSI RTX 4060 Ventus 2X 8GB", priceCash: 320_000, inStock: false }),
    offer("alfa", "3", { category: "cpu", title: "AMD Ryzen 7 7800X3D", priceCash: 420_000 }),
  ]);
  beta.setOffers([
    offer("beta", "9", {
      category: "gpu",
      title: "Asus Dual RTX4070 Super O12G",
      priceCash: 639_990,
      mpn: "DUAL-RTX4070S-O12G",
    }),
  ]);
  await crawlCategory(deps, alfa.store, "gpu");
  await crawlCategory(deps, alfa.store, "cpu");
  await crawlCategory(deps, beta.store, "gpu");
  clock.advance(3600_000);
  beta.setOffers([
    offer("beta", "9", {
      category: "gpu",
      title: "Asus Dual RTX4070 Super O12G",
      priceCash: 599_990,
      mpn: "DUAL-RTX4070S-O12G",
    }),
  ]);
  await crawlCategory(deps, beta.store, "gpu");
});
afterAll(() => dispose());

describe("API pública", () => {
  test("GET /health", async () => {
    expect((await (await get("/health")).json()) as object).toEqual({ status: "ok" });
  });

  test("listado por categoría con mejor precio y cantidad de ofertas", async () => {
    const res = await get("/v1/products?category=gpu&sort=price_asc");
    expect(res.status).toBe(200);
    const page = ProductPageSchema.parse(await res.json());
    expect(page.total).toBe(2);
    expect(page.items.map((p) => [p.name, p.bestPrice, p.offerCount])).toEqual([
      ["ASUS Dual RTX 4070 SUPER OC 12GB", 599_990, 2],
      // Sin stock: sin mejor precio, va al final aunque sea más barata.
      ["MSI RTX 4060 Ventus 2X 8GB", null, 1],
    ]);
  });

  test("filtro inStock y búsqueda por texto (con prefijos)", async () => {
    const inStock = ProductPageSchema.parse(await (await get("/v1/products?category=gpu&inStock=true")).json());
    expect(inStock.items).toHaveLength(1);
    const search = ProductPageSchema.parse(await (await get("/v1/products?q=ryz 7800")).json());
    expect(search.items.map((p) => p.category)).toEqual(["cpu"]);
  });

  test("detalle con ofertas ordenadas e historial sólo con cambios", async () => {
    const list = ProductPageSchema.parse(await (await get("/v1/products?q=4070")).json());
    const slug = list.items[0]?.slug ?? "";
    const detail = ProductDetailSchema.parse(await (await get(`/v1/products/${slug}`)).json());
    expect(detail.offers.map((o) => [o.store.slug, o.priceCash])).toEqual([
      ["beta", 599_990],
      ["alfa", 650_000],
    ]);
    expect(detail.attributes).toMatchObject({ chipset: "rtx 4070 super", vram: 12 });

    const history = z
      .object({ items: z.array(PricePointSchema) })
      .parse(await (await get(`/v1/products/${slug}/price-history`)).json());
    expect(history.items.map((p) => [p.store, p.priceCash])).toEqual([
      ["alfa", 650_000],
      ["beta", 639_990],
      ["beta", 599_990],
    ]);
  });

  test("errores con formato único", async () => {
    const notFound = await get("/v1/products/no-existe");
    expect(notFound.status).toBe(404);
    expect(ApiErrorSchema.parse(await notFound.json()).error.code).toBe("product_not_found");

    const invalid = await get("/v1/products?category=tostadoras");
    expect(invalid.status).toBe(400);
    expect(ApiErrorSchema.parse(await invalid.json()).error.code).toBe("invalid_request");
  });

  test("categorías y tiendas", async () => {
    const categories = (await (await get("/v1/categories")).json()) as {
      items: { id: string; productCount: number }[];
    };
    expect(categories.items.find((c) => c.id === "gpu")?.productCount).toBe(2);
    const stores = (await (await get("/v1/stores")).json()) as { items: { slug: string; offerCount: number }[] };
    expect(stores.items.map((s) => [s.slug, s.offerCount])).toEqual([
      ["alfa", 3],
      ["beta", 1],
    ]);
  });
});

describe("API admin", () => {
  const auth = { headers: { authorization: "Bearer test-admin-token", "content-type": "application/json" } };

  test("sin token → 401", async () => {
    expect((await get("/v1/admin/crawls")).status).toBe(401);
    expect((await get("/v1/admin/crawls", { headers: { authorization: "Bearer otro" } })).status).toBe(401);
  });

  test("encola crawls filtrados por tienda y categoría", async () => {
    sent.length = 0;
    const res = await get("/v1/admin/crawls", {
      ...auth,
      method: "POST",
      body: JSON.stringify({ store: "tectec", category: "gpu" }),
    });
    expect(res.status).toBe(202);
    expect((await res.json()) as object).toEqual({ enqueued: 1 });
    expect(sent[0]).toMatchObject({ type: "crawl.category", store: "tectec", category: "gpu", requestedBy: "admin" });
  });

  test("historial de corridas y cuarentena", async () => {
    const runs = (await (await get("/v1/admin/crawls", auth)).json()) as { items: { status: string }[] };
    expect(runs.items).toHaveLength(4);
    expect(runs.items.every((r) => r.status === "succeeded")).toBe(true);
    const quarantine = (await (await get("/v1/admin/quarantine", auth)).json()) as { items: unknown[] };
    expect(quarantine.items).toEqual([]);
  });
});
