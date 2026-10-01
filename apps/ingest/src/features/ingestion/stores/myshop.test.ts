import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import { normalizeOffer } from "../domain/normalize";
// Respuestas reales de MyShop (y un ítem de Sandos), recortadas a dos páginas.
import pages from "./__fixtures__/myshop-productos.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createMyShopAdapter } from "./myshop";

function fakeContext() {
  const bodies: unknown[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    http: {
      get: async (url) => {
        throw new HttpError(url, 404);
      },
      async post(url, json) {
        bodies.push(json);
        const page = pages[Number((json as { page: string }).page) - 1];
        if (!page || url !== "https://tienda.example/servicio/producto") throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text: JSON.stringify(page) };
      },
    },
  };
  return { ctx, bodies };
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
});
