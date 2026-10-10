import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import type { RawOffer } from "../domain/normalize";
// Listado y ficha reales de Winpy (oct. 2026), recortados: dos productos del listado (una GPU y un kit) y la ficha
// de la GPU. El kit no tiene ficha en el fixture: simula un 404 entre listado y ficha.
import fixture from "./__fixtures__/winpy.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createWinpyAdapter, fichaDue, listingCards, toRawOffer } from "./winpy";

const BASE = "https://www.winpy.cl";
const GPU = "tarjeta-grafica-asus-dual-geforce-rtx-5050-oc-de-8gb-gddr6";
const pages: Record<string, string> = {
  [`${BASE}/partes-y-piezas/tarjetas-graficas/?pagina=1`]: fixture.listing,
  [`${BASE}/partes-y-piezas/tarjetas-graficas/?pagina=2`]: "<html><body></body></html>",
  [`${BASE}/venta/${GPU}/`]: fixture.product,
};

function fakeContext(known: Record<string, RawOffer> = {}) {
  const urls: string[] = [];
  const ctx: CrawlContext = {
    known: async (url) => known[url],
    log: silentLogger,
    snapshot: async () => {},
    http: {
      async get(url) {
        urls.push(url);
        const text = pages[url];
        if (text === undefined) throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text };
      },
      post: async (url) => {
        throw new HttpError(url, 405);
      },
    },
  };
  return { ctx, urls };
}

const adapter = createWinpyAdapter({ baseUrl: BASE, categories: { gpu: ["partes-y-piezas/tarjetas-graficas"] } });

describe("adaptador Winpy", () => {
  test("el listado trae slug y precio de transferencia, sin los promocionados de la barra lateral", () => {
    expect(listingCards(fixture.listing).map((c) => c.slug)).toEqual([
      GPU,
      "kit-tarjeta-grafica-msi-gt710-2gb-procesador-intel-core-i5-12400f-lga1700-6-cores-12-hilos",
    ]);
    expect(listingCards(fixture.listing)[0]?.priceCash).toBe(449_920);
  });

  test("un producto conocido con el mismo precio no pide la ficha; con otro precio o en su turno diario, sí", async () => {
    const url = `${BASE}/venta/${GPU}/`;
    const guardada = { ...toRawOffer(fixture.product, url, "gpu"), stockQuantity: 9 };
    const libre = Array.from({ length: 8 }, (_, i) => i * 6 * 3_600_000).find((t) => !fichaDue(GPU, t)) ?? 0;
    const turno = Array.from({ length: 8 }, (_, i) => i * 6 * 3_600_000).find((t) => fichaDue(GPU, t)) ?? 0;
    const crawl = async (known: RawOffer, now: number) => {
      const { ctx, urls } = fakeContext({ [url]: known });
      const winpy = createWinpyAdapter({
        baseUrl: BASE,
        categories: { gpu: ["partes-y-piezas/tarjetas-graficas"] },
        now: () => now,
      });
      const offers = await Array.fromAsync(winpy.crawlCategory("gpu", ctx));
      return { offers, pidioFicha: urls.includes(url) };
    };

    const igual = await crawl(guardada, libre);
    expect(igual.pidioFicha).toBe(false);
    expect(igual.offers[0]).toMatchObject({ externalId: "DUAL-RTX5050-O8G", stockQuantity: 9, priceCash: 449_920 });

    expect((await crawl({ ...guardada, priceCash: 400_000 }, libre)).pidioFicha).toBe(true);
    expect((await crawl(guardada, turno)).pidioFicha).toBe(true);
  });

  test("cada producto repasa su ficha en uno de los cuatro turnos del día", () => {
    const turnos = (slug: string) =>
      Array.from({ length: 4 }, (_, i) => i * 6 * 3_600_000).filter((t) => fichaDue(slug, t)).length;
    expect([GPU, "otro-producto", "tercero"].map(turnos)).toEqual([1, 1, 1]);
  });

  test("pagina hasta la vacía, entra a cada ficha y salta la que ya no existe", async () => {
    const { ctx, urls } = fakeContext();
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));
    expect(urls[0]).toBe(`${BASE}/partes-y-piezas/tarjetas-graficas/?pagina=1`);
    expect(urls.at(-1)).toBe(`${BASE}/partes-y-piezas/tarjetas-graficas/?pagina=2`);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      externalId: "DUAL-RTX5050-O8G",
      url: `${BASE}/venta/${GPU}/`,
      title: "Tarjeta gráfica ASUS Dual GeForce RTX 5050 OC de 8GB GDDR6",
      category: "gpu",
      priceCash: 449_920,
      priceCard: 473_600,
      inStock: true,
      stockQuantity: 4,
      brand: "Asus",
      mpn: "DUAL-RTX5050-O8G",
      gtin: "199275573873",
    });
    expect(offers[0]?.imageUrls[0]).toMatch(/^https:\/\/www\.winpy\.cl\/files\//);
  });

  test("un nombre con una parte en negrita se lee entero", () => {
    const html = `<h1 itemprop="name"><b>Tarjeta gráfica MSI GeForce RTX 5050 8G SHADOW 2X OC</b> (8GB GDDR6, PCIe 5.0)</h1>
      <span class="sku" itemprop="sku">G5050-8S2C</span><span itemprop="offerCount" class="hidden">3</span>`;
    const offer = toRawOffer(html, "https://www.winpy.cl/venta/x/", "gpu");
    expect(offer.title).toBe("Tarjeta gráfica MSI GeForce RTX 5050 8G SHADOW 2X OC (8GB GDDR6, PCIe 5.0)");
    expect(offer.externalId).toBe("G5050-8S2C");
  });

  test("un kit lleva código propio: no es MPN; sin unidades, sin stock", () => {
    const html = fixture.product
      .replace('itemprop="sku">DUAL-RTX5050-O8G', 'itemprop="sku">KT037XCL23')
      .replace('itemprop="offerCount" class="hidden">4', 'itemprop="offerCount" class="hidden">0');
    expect(toRawOffer(html, `${BASE}/venta/kit/`, "gpu")).toMatchObject({
      externalId: "KT037XCL23",
      mpn: null,
      inStock: false,
      stockQuantity: 0,
    });
  });
});
