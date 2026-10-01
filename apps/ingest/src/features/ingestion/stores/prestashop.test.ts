import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import { normalizeOffer } from "../domain/normalize";
// Listados AJAX reales de MyBox, Todoclick y TYT Gamer (sept. 2026), recortados a los campos que se usan.
import listados from "./__fixtures__/prestashop-listados.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createPrestaShopAdapter, type PrestaShopConfig, toRawOffer } from "./prestashop";

function fakeContext(pages: readonly unknown[], path: string) {
  const requests: { url: string; headers?: Record<string, string> }[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    http: {
      async get(url, init) {
        requests.push({ url, headers: init?.headers });
        const page = pages[Number(new URL(url).searchParams.get("page")) - 1];
        if (!page || !url.startsWith(`https://tienda.example/${path}?`)) throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text: JSON.stringify(page) };
      },
      post: async (url) => {
        throw new HttpError(url, 405);
      },
    },
  };
  return { ctx, requests };
}

const crawl = (pages: readonly unknown[], config: Omit<PrestaShopConfig, "baseUrl" | "categories">) => {
  const adapter = createPrestaShopAdapter({
    ...config,
    baseUrl: "https://tienda.example",
    categories: { gpu: ["68-x"] },
  });
  const { ctx, requests } = fakeContext(pages, "68-x");
  return { offers: Array.fromAsync(adapter.crawlCategory("gpu", ctx)), requests };
};

describe("adaptador PrestaShop", () => {
  test("pagina con pages_count y pide el JSON del listado con X-Requested-With", async () => {
    const { offers, requests } = crawl(listados.mybox, { reference: "mpn", cashDiscount: 0.05 });
    expect(await offers).toHaveLength(3);
    expect(requests).toEqual([
      { url: "https://tienda.example/68-x?page=1", headers: { "X-Requested-With": "XMLHttpRequest" } },
      { url: "https://tienda.example/68-x?page=2", headers: { "X-Requested-With": "XMLHttpRequest" } },
    ]);
  });

  test("MyBox: price_amount es tarjeta y la transferencia tiene −5 %", async () => {
    const [offer, soldOut, noBrand] = await crawl(listados.mybox, { reference: "mpn", cashDiscount: 0.05 }).offers;
    expect(offer).toMatchObject({
      externalId: "6197",
      url: "https://mybox.cl/tarjeta-de-video/6197-tarjeta-de-video-asus-x-t1-rtx-5060-ti-gaming-8gb-oc-.html",
      // Ficha: $ 631.741 y "$ 31.587 descuento en Pagos por transferencia bancaria". El $ 664.990 tachado no se usa.
      priceCash: 600_154,
      priceCard: 631_741,
      inStock: true,
      stockQuantity: null,
      brand: "Asus",
      mpn: "T1-RTX5060TI-O8G-GAMING",
      gtin: null,
      imageUrls: ["https://mybox.cl/17376-thickbox_default/tarjeta-de-video-asus-x-t1-rtx-5060-ti-gaming-8gb-oc-.jpg"],
    });
    expect(soldOut).toMatchObject({ externalId: "6196", inStock: false, stockQuantity: 0 });
    expect(noBrand).toMatchObject({ externalId: "5601", brand: null, mpn: "VCNRTX5000ADA-PB" });
    expect(normalizeOffer(offer, "gpu").ok).toBe(true);
  });

  test("MyBox: el descuento se redondea antes de restarlo (ficha del Arctic S12038-8K: $ 24.990, descuento $ 1.250)", () => {
    const product = { ...listados.mybox[0]?.products[0], price_amount: 24_990 } as Parameters<typeof toRawOffer>[0];
    expect(toRawOffer(product, "case_fan", { reference: "mpn", cashDiscount: 0.05 }).priceCash).toBe(23_740);
  });

  test("Todoclick: price_amount es transferencia (Khipu) y otros medios +1,7 %; un UPC en reference es GTIN", async () => {
    const [offer, upc] = await crawl(listados.todoclick, { reference: "mpn", cardMarkup: 0.017 }).offers;
    expect(offer).toMatchObject({ externalId: "9645", priceCash: 249_990, priceCard: 254_240, mpn: "912-V812-201" });
    expect(upc).toMatchObject({ externalId: "9388", gtin: "824142438329", mpn: null, inStock: false });
  });

  test("TYT Gamer: referencia interna no es MPN y sin manufacturer_name no hay marca", async () => {
    const [offer] = await crawl(listados.tytgamer, { reference: "internal", cardMarkup: 0.05 }).offers;
    expect(offer).toMatchObject({
      externalId: "3043",
      priceCash: 196_990,
      priceCard: 206_840,
      mpn: null,
      gtin: null,
      brand: null,
      inStock: true,
    });
  });

  test("con un solo precio la tarjeta queda en null", async () => {
    const [offer] = await crawl(listados.tytgamer, { reference: "internal" }).offers;
    expect(offer).toMatchObject({ priceCash: 196_990, priceCard: null });
  });

  test("un producto mal formado llega crudo a normalize y termina en cuarentena", async () => {
    const broken = [{ products: [{ id_product: "1", name: "Sin precio" }], pagination: { pages_count: 1 } }];
    const [offer] = await crawl(broken, { reference: "mpn" }).offers;
    expect(normalizeOffer(offer, "gpu")).toMatchObject({ ok: false });
  });
});
