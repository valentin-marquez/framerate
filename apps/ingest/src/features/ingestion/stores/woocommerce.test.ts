import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import { normalizeOffer } from "../domain/normalize";
// Fixture sintético con la forma de la WC Store API v1. Reemplazar por
// respuestas reales guardadas (snapshots de R2) a medida que se verifican tiendas.
import products from "./__fixtures__/woocommerce-products.json";
import type { CrawlContext } from "./adapter";
import { createHttpClient, HttpError } from "./http";
import { createWooCommerceAdapter } from "./woocommerce";

function fakeContext(pages: Record<string, { body: unknown; totalPages?: number }>) {
  const requested: string[] = [];
  const snapshots: string[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async (name) => {
      snapshots.push(name);
    },
    http: {
      async get(url) {
        requested.push(url);
        const page = pages[url];
        if (!page) throw new HttpError(url, 404);
        return {
          status: 200,
          headers: new Headers({ "x-wp-totalpages": String(page.totalPages ?? 1) }),
          text: JSON.stringify(page.body),
        };
      },
    },
  };
  return { ctx, requested, snapshots };
}

const api = (slug: string, page: number) =>
  `https://tienda.example/wp-json/wc/store/v1/products?category=${slug}&per_page=2&page=${page}`;

describe("adaptador WooCommerce", () => {
  const adapter = createWooCommerceAdapter({
    baseUrl: "https://tienda.example",
    sku: "mpn",
    perPage: 2,
    categories: { gpu: ["tarjetas-de-video"] },
  });

  test("pagina hasta agotar, guarda snapshots y mapea campos", async () => {
    const { ctx, requested, snapshots } = fakeContext({
      [api("tarjetas-de-video", 1)]: { body: products.slice(0, 2), totalPages: 2 },
      [api("tarjetas-de-video", 2)]: { body: products.slice(2), totalPages: 2 },
    });
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));

    expect(requested).toHaveLength(2);
    expect(snapshots).toEqual(["tarjetas-de-video/page-1.json", "tarjetas-de-video/page-2.json"]);
    expect(offers).toHaveLength(3);
    expect(offers[0]).toMatchObject({
      externalId: "5011",
      priceCash: 649_990,
      priceCard: 689_990,
      brand: "Asus",
      mpn: "DUAL-RTX4070S-O12G",
      gtin: null,
      stockQuantity: 3,
    });
  });

  test("respeta currency_minor_unit, decodifica entidades y detecta GTIN en el SKU", async () => {
    const { ctx } = fakeContext({ [api("tarjetas-de-video", 1)]: { body: [products[1]] } });
    const [offer] = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));
    expect(offer).toMatchObject({
      title: "Procesador AMD Ryzen 7 7800X3D - AM5",
      priceCash: 419_990,
      priceCard: 439_990,
      gtin: "0730143314930",
      mpn: null,
      inStock: false,
      stockQuantity: 0,
    });
  });

  test("un producto sin precio llega a normalize y termina en cuarentena", async () => {
    const { ctx } = fakeContext({ [api("tarjetas-de-video", 1)]: { body: [products[2]] } });
    const [offer] = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));
    expect(normalizeOffer(offer, "gpu")).toMatchObject({ ok: false, reason: "schema:priceCash:too_small" });
  });

  test("categoría no vendida por la tienda no hace requests", async () => {
    const { ctx, requested } = fakeContext({});
    expect(await Array.fromAsync(adapter.crawlCategory("case", ctx))).toEqual([]);
    expect(requested).toEqual([]);
  });
});

describe("cliente HTTP", () => {
  const noSleep = async () => {};

  test("reintenta ante 503 y luego responde", async () => {
    let calls = 0;
    const http = createHttpClient({
      sleep: noSleep,
      fetch: (async () => {
        calls++;
        return calls < 3 ? new Response("down", { status: 503 }) : new Response("[]", { status: 200 });
      }) as unknown as typeof fetch,
    });
    const res = await http.get("https://tienda.example/api");
    expect(res.text).toBe("[]");
    expect(calls).toBe(3);
  });

  test("no reintenta un 404", async () => {
    let calls = 0;
    const http = createHttpClient({
      sleep: noSleep,
      fetch: (async () => {
        calls++;
        return new Response("no", { status: 404 });
      }) as unknown as typeof fetch,
    });
    expect(http.get("https://tienda.example/x")).rejects.toBeInstanceOf(HttpError);
    await Bun.sleep(0);
    expect(calls).toBe(1);
  });

  test("envía User-Agent identificable", async () => {
    let ua: string | null = null;
    const http = createHttpClient({
      sleep: noSleep,
      fetch: (async (_url: string, init: RequestInit) => {
        ua = new Headers(init.headers).get("user-agent");
        return new Response("ok");
      }) as unknown as typeof fetch,
    });
    await http.get("https://tienda.example/");
    expect(ua ?? "").toContain("FramerateBot");
  });
});
