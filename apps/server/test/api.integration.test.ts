import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  ApiErrorSchema,
  type BrandCount,
  PricePointSchema,
  PriceRangeSchema,
  ProductDetailSchema,
  ProductPageSchema,
  SitemapSchema,
} from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1 } from "@framerate/database/testing";
import { z } from "zod";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { daysAgo, seedCatalog, testEnv } from "./helpers";

/** API HTTP de punta a punta; las respuestas se validan contra `@framerate/contracts`. */

let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const crawlRequests: Parameters<Env["INGEST"]["enqueueCrawls"]>[0][] = [];
let refuseUnknownStore = false;
const app = createApp();
const get = (path: string, init?: RequestInit) => app.request(path, init, env);
const code = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

beforeAll(async () => {
  let d1: D1Database;
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1, {
    enqueueCrawls: async (request) => {
      crawlRequests.push(request);
      return refuseUnknownStore ? { ok: false, error: "unknown_store" } : { ok: true, enqueued: 1 };
    },
  }));
  const seed = await seedCatalog(db);
  await db.query
    .insertInto("product_identifiers")
    .values({ kind: "mpn", value: "DUALRTX4070SO12G", product_id: seed.asus })
    .execute();
  await db.query
    .insertInto("product_slug_redirects")
    .values({ old_slug: "asus-dual-4070s-viejo", product_id: seed.asus, created_at: new Date().toISOString() })
    .execute();
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

describe("catálogo: filtros, orden y datos auxiliares", () => {
  const list = async (qs: string) => ProductPageSchema.parse(await (await get(`/v1/products?${qs}`)).json());
  const names = (page: { items: { name: string }[] }) => page.items.map((p) => p.name);

  test("cada producto trae id, MPN y el precio más bajo aunque nadie tenga stock", async () => {
    const page = await list("category=gpu&sort=name");
    const [asus, msi] = page.items;
    expect(asus).toMatchObject({ mpn: "DUALRTX4070SO12G", bestPrice: 599_990, lowestPrice: 599_990 });
    expect(asus?.id).toBeGreaterThan(0);
    expect(msi).toMatchObject({ mpn: null, bestPrice: null, lowestPrice: 320_000 });
  });

  test("filtra por marca (por slug o por nombre) y por rango de precio", async () => {
    expect(names(await list("category=gpu&brand=asus"))).toEqual(["ASUS Dual RTX 4070 SUPER OC 12GB"]);
    expect(names(await list("category=gpu&brand=ASUS"))).toEqual(["ASUS Dual RTX 4070 SUPER OC 12GB"]);
    expect(names(await list("category=gpu&minPrice=400000"))).toEqual(["ASUS Dual RTX 4070 SUPER OC 12GB"]);
    expect(names(await list("category=gpu&maxPrice=400000"))).toEqual(["MSI RTX 4060 Ventus 2X 8GB"]);
    expect((await list("category=gpu&minPrice=1000000")).total).toBe(0);
  });

  test("ordena por nombre y por popularidad (vistas de los últimos 7 días)", async () => {
    expect(names(await list("category=gpu&sort=name"))).toEqual([
      "ASUS Dual RTX 4070 SUPER OC 12GB",
      "MSI RTX 4060 Ventus 2X 8GB",
    ]);
    for (let i = 0; i < 3; i++) {
      expect((await get("/v1/products/msi-rtx-4060-ventus-2x-8gb/view", { method: "POST" })).status).toBe(204);
    }
    expect(names(await list("category=gpu&sort=popularity"))[0]).toBe("MSI RTX 4060 Ventus 2X 8GB");
    expect((await get("/v1/products/no-existe/view", { method: "POST" })).status).toBe(404);
  });

  test("marcas con conteo y rango de precios de una categoría", async () => {
    const brands = (await (await get("/v1/categories/tarjetas-de-video/brands")).json()) as { items: BrandCount[] };
    expect(brands.items).toEqual([
      { name: "ASUS", slug: "asus", count: 1 },
      { name: "MSI", slug: "msi", count: 1 },
    ]);
    expect(PriceRangeSchema.parse(await (await get("/v1/categories/tarjetas-de-video/price-range")).json())).toEqual({
      min: 320_000,
      max: 599_990,
    });
    const unknown = await get("/v1/categories/tostadoras/brands");
    expect(unknown.status).toBe(404);
    expect(await code(unknown)).toBe("category_not_found");
  });

  test("redirección de un slug antiguo al vigente", async () => {
    expect((await (await get("/v1/products/redirects/asus-dual-4070s-viejo")).json()) as object).toEqual({
      slug: "asus-dual-rtx-4070-super-oc-12gb",
    });
    expect((await get("/v1/products/redirects/nada")).status).toBe(404);
  });

  test("mapa del sitio con productos, categorías con productos y tiendas", async () => {
    const map = SitemapSchema.parse(await (await get("/v1/sitemap")).json());
    expect(map.products.sort()).toEqual([
      "amd-ryzen-7-7800x3d",
      "asus-dual-rtx-4070-super-oc-12gb",
      "msi-rtx-4060-ventus-2x-8gb",
    ]);
    expect(map.categories).toEqual(["tarjetas-de-video", "procesadores"]);
    expect(map.stores).toEqual(["alfa", "beta"]);
  });
});

describe("API admin", () => {
  const auth = { headers: { authorization: "Bearer test-admin-token", "content-type": "application/json" } };

  test("sin token → 401", async () => {
    expect((await get("/v1/admin/crawls")).status).toBe(401);
    expect((await get("/v1/admin/crawls", { headers: { authorization: "Bearer otro" } })).status).toBe(401);
  });

  test("pide a ingest que encole (la API no toca la cola ni conoce las tiendas)", async () => {
    crawlRequests.length = 0;
    const res = await get("/v1/admin/crawls", {
      ...auth,
      method: "POST",
      body: JSON.stringify({ store: "tectec", category: "gpu" }),
    });
    expect(res.status).toBe(202);
    expect((await res.json()) as object).toEqual({ enqueued: 1 });
    expect(crawlRequests).toEqual([{ store: "tectec", category: "gpu", requestedBy: "admin-token" }]);
  });

  test("tienda desconocida según ingest → 400 con código", async () => {
    refuseUnknownStore = true;
    const res = await get("/v1/admin/crawls", { ...auth, method: "POST", body: JSON.stringify({ store: "nada" }) });
    refuseUnknownStore = false;
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("unknown_store");
  });

  test("historial de corridas y cuarentena", async () => {
    const store = await db.query.selectFrom("stores").select("id").where("slug", "=", "alfa").executeTakeFirstOrThrow();
    await db.query
      .insertInto("crawl_runs")
      .values({
        id: "run-1",
        store_id: store.id,
        category: "gpu",
        status: "succeeded",
        started_at: daysAgo(1),
        stats: JSON.stringify({ seen: 3, valid: 2, quarantined: 1 }),
      })
      .execute();
    await db.query
      .insertInto("quarantine")
      .values({
        run_id: "run-1",
        store_id: store.id,
        external_id: "77",
        reason: "price:out_of_range",
        payload: JSON.stringify({ title: "Soporte" }),
        created_at: daysAgo(1),
      })
      .execute();

    const runs = (await (await get("/v1/admin/crawls", auth)).json()) as {
      items: { id: string; store: string; status: string; stats: { seen: number } }[];
    };
    expect(runs.items).toMatchObject([{ id: "run-1", store: "alfa", status: "succeeded", stats: { seen: 3 } }]);
    const quarantine = (await (await get("/v1/admin/quarantine?runId=run-1", auth)).json()) as {
      items: { reason: string; payload: { title: string } }[];
    };
    expect(quarantine.items).toMatchObject([{ reason: "price:out_of_range", payload: { title: "Soporte" } }]);
  });
});
