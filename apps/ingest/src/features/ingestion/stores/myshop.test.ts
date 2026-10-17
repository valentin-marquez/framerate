import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import { normalizeOffer, type RawOffer } from "../domain/normalize";
// Respuestas reales de MyShop (y un ítem de Sandos), recortadas a dos páginas.
import pages from "./__fixtures__/myshop-productos.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createMyShopAdapter, descriptionOf } from "./myshop";

// Fichas reales recortadas al input ObjectoJSON con su descripción: MyShop p38668 y una de Sandos sin descripción.
const ficha = await Bun.file(`${import.meta.dir}/__fixtures__/myshop-ficha.html`).text();
const fichaVacia = await Bun.file(`${import.meta.dir}/__fixtures__/myshop-ficha-sandos-vacia.html`).text();

function fakeContext(fichas: (url: string) => string | null = () => null, known: RawOffer[] = []) {
  const bodies: unknown[] = [];
  const gets: string[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    known: async (url) => known.find((offer) => offer.url === url),
    http: {
      get: async (url) => {
        gets.push(url);
        const html = fichas(url);
        if (html === null) throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text: html };
      },
      async post(url, json) {
        bodies.push(json);
        const page = pages[Number((json as { page: string }).page) - 1];
        if (!page || url !== "https://tienda.example/servicio/producto") throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text: JSON.stringify(page) };
      },
    },
  };
  return { ctx, bodies, gets };
}

describe("adaptador MyShop", () => {
  const adapter = createMyShopAdapter({ baseUrl: "https://tienda.example", categories: { gpu: ["33"] } });

  test("pagina con productos.fin/count y mapea los dos precios, MPN y stock", async () => {
    const { ctx, bodies } = fakeContext();
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));

    expect(bodies).toEqual([
      { tipo: "3", page: "1", idFamilia: "33" },
      { tipo: "3", page: "2", idFamilia: "33" },
    ]);
    expect(offers).toHaveLength(5);
    expect(offers[1]).toMatchObject({
      externalId: "28294",
      url: "https://tienda.example/producto/asus-dual-rtx3050-o6g-pci-express-40-nvidia-nvidia-geforce-rtx-3050-p28294",
      priceCash: 257_700,
      priceCard: 271_874,
      brand: "Asus",
      mpn: "DUAL-RTX3050-O6G",
      gtin: null,
      inStock: true,
      // 21 es el "+20" de la tienda, no una cantidad real.
      stockQuantity: null,
    });
    expect(offers[1]?.imageUrls).toHaveLength(2);
  });

  test("un UPC en partno es GTIN, no MPN", async () => {
    const [offer] = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));
    expect(offer).toMatchObject({ gtin: "824142126905", mpn: null });
  });

  test("etiqueta Agotado deja la oferta sin stock", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));
    expect(offers[2]).toMatchObject({ externalId: "36730", inStock: false, stockQuantity: 0 });
  });

  test("un kit no toma los códigos internos como MPN y queda en cuarentena", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));
    expect(offers[3]).toMatchObject({ externalId: "44106", mpn: null, gtin: null });
    expect(normalizeOffer({ ...offers[3], category: "ram" }, "ram")).toMatchObject({ ok: false, reason: "bundle" });
  });

  test("entrega diferida de Sandos (api: 1, sin disponibleInternet) cuenta como stock", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));
    expect(offers[4]).toMatchObject({ externalId: "11902", inStock: true, stockQuantity: 20 });
  });

  test("la oferta nueva pide su ficha y trae la descripción como texto", async () => {
    const { ctx, gets } = fakeContext(() => ficha);
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));
    // La agotada no se guarda: su ficha no se pide.
    expect(gets).toHaveLength(offers.filter((o) => o.inStock).length);
    expect(offers.find((o) => !o.inStock)?.sourceText).toBeNull();
    expect(offers[0]?.sourceText).toContain("Especificaciones técnicas\nMarca: Airflow");
    expect(offers[0]?.sourceText).toContain("Ruido: 22.8 dBA");
    expect(offers[0]?.sourceText).not.toContain("<");
  });

  test("la conocida con texto no vuelve a pedir la ficha", async () => {
    const first = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));
    const known = first.map((offer) => ({ ...offer, sourceText: "Guardado" }));
    const { ctx, gets } = fakeContext(() => ficha, known);
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));
    expect(gets).toEqual([]);
    expect(offers.map((offer) => offer.sourceText)).toEqual(Array(5).fill("Guardado"));
  });

  test("ficha que falla o sin input: la oferta entra igual, sin texto", async () => {
    const { ctx } = fakeContext((url) => {
      throw new HttpError(url, 429);
    });
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));
    expect(offers).toHaveLength(5);
    expect(offers.every((offer) => offer.sourceText === null)).toBe(true);
    expect(descriptionOf("<html></html>")).toBeNull();
  });
});

test('Sandos con "Ficha sin descripción" no tiene texto', () => {
  expect(descriptionOf(fichaVacia)).toBeNull();
});
