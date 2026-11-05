import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import { normalizeOffer, type RawOffer } from "../domain/normalize";
// Respuesta real de Progaming (05-11-2026), recortada a tres productos.
import fixture from "./__fixtures__/shopify-products.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { findStore } from "./registry";
import { createShopifyAdapter } from "./shopify";

const BASE = "https://tienda.example";
const url = (page: number) => `${BASE}/collections/gabinetes/products.json?limit=250&page=${page}`;

function fakeContext(pages: Record<string, unknown>) {
  const requested: string[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    http: {
      async get(u) {
        requested.push(u);
        if (!(u in pages)) throw new HttpError(u, 404);
        return { status: 200, headers: new Headers(), text: JSON.stringify(pages[u]) };
      },
      post: async (u) => {
        throw new HttpError(u, 405);
      },
    },
  };
  return { ctx, requested };
}

const collect = async (offers: AsyncIterable<RawOffer>) => {
  const all: RawOffer[] = [];
  for await (const offer of offers) all.push(offer);
  return all;
};

const adapter = createShopifyAdapter({ baseUrl: BASE, categories: { case: ["gabinetes"] }, cardMarkup: 1 / 0.94 - 1 });
const [first, second, soldOut] = fixture.products as [
  (typeof fixture.products)[number],
  (typeof fixture.products)[number],
  (typeof fixture.products)[number],
];

describe("adaptador Shopify", () => {
  test("arma la oferta con el precio transferencia, el recargo y una URL propia", async () => {
    const { ctx } = fakeContext({ [url(1)]: { products: [second] } });
    const [offer] = await collect(adapter.crawlCategory("case", ctx));
    const price = Number(second.variants[0]?.price);

    expect(offer).toMatchObject({
      externalId: String(second.id),
      url: `${BASE}/products/${second.handle}`,
      priceCash: price,
      priceCard: Math.round(price / 0.94),
      inStock: true,
      stockQuantity: null,
      brand: second.vendor,
      mpn: null,
      gtin: second.variants[0]?.sku,
    });
    expect(normalizeOffer(offer as RawOffer, "case").ok).toBe(true);
  });

  test("sin recargo verificado no hay precio tarjeta", async () => {
    const plain = createShopifyAdapter({ baseUrl: BASE, categories: { case: ["gabinetes"] } });
    const { ctx } = fakeContext({ [url(1)]: { products: [second] } });
    expect((await collect(plain.crawlCategory("case", ctx)))[0]?.priceCard).toBeNull();
  });

  test("un SKU que no pasa el dígito verificador no es GTIN ni MPN", async () => {
    const internal = { ...first, variants: [{ ...first.variants[0], sku: "ABC-123" }] };
    const { ctx } = fakeContext({ [url(1)]: { products: [internal] } });
    expect((await collect(adapter.crawlCategory("case", ctx)))[0]).toMatchObject({ gtin: null, mpn: null });
  });

  test("un producto sin variantes disponibles entra agotado", async () => {
    const { ctx } = fakeContext({ [url(1)]: { products: [soldOut] } });
    expect((await collect(adapter.crawlCategory("case", ctx)))[0]).toMatchObject({ inStock: false, stockQuantity: 0 });
  });

  test("con variantes mezcladas toma la disponible", async () => {
    const variant = first.variants[0] as (typeof first.variants)[number];
    const mixed = {
      ...first,
      variants: [
        { ...variant, available: false, price: "1000" },
        { ...variant, available: true, price: "2000" },
      ],
    };
    const { ctx } = fakeContext({ [url(1)]: { products: [mixed] } });
    expect((await collect(adapter.crawlCategory("case", ctx)))[0]).toMatchObject({ inStock: true, priceCash: 2000 });
  });

  test("recorre las páginas hasta una incompleta", async () => {
    const full = Array.from({ length: 250 }, (_, i) => ({ ...second, id: i + 1 }));
    const { ctx, requested } = fakeContext({ [url(1)]: { products: full }, [url(2)]: { products: [first] } });

    expect(await collect(adapter.crawlCategory("case", ctx))).toHaveLength(251);
    expect(requested).toEqual([url(1), url(2)]);
  });

  test("un item mal formado se entrega crudo y normalize lo rechaza", async () => {
    const { ctx } = fakeContext({ [url(1)]: { products: [{ id: "x" }, second] } });
    const offers = await collect(adapter.crawlCategory("case", ctx));

    expect(offers).toHaveLength(2);
    expect(normalizeOffer(offers[0] as RawOffer, "case").ok).toBe(false);
  });

  test("el refresco deja de pedir páginas al ver todas las ofertas", async () => {
    const full = Array.from({ length: 250 }, (_, i) => ({ ...second, id: i + 1 }));
    const { ctx, requested } = fakeContext({ [url(1)]: { products: full }, [url(2)]: { products: [first] } });
    const refs = [{ externalId: "7", url: "", category: "case" as const }];

    const offers = await collect(adapter.refreshOffers?.(refs, ctx) as AsyncIterable<RawOffer>);

    expect(offers.map((o) => o.externalId)).toEqual(["7"]);
    expect(requested).toEqual([url(1)]);
  });

  test("Progaming lee sus colecciones de Shopify", () => {
    const store = findStore("progaming");
    expect(store?.pausedReason).toBeUndefined();
    expect(store?.adapter.categories.gpu).toEqual(["tarjetas-de-video"]);
    expect(store?.adapter.refreshOffers).toBeDefined();
  });
});
