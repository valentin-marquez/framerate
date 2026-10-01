import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
// Respuestas reales del MCP de NotebookStore y Valrod, sin descripciones; de las fichas sólo quedan sus metas de precio.
import fixture from "./__fixtures__/jumpseller.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createJumpsellerAdapter } from "./jumpseller";

type Call = { category: string; page: number; limit: number };

function fakeContext() {
  const calls: Call[] = [];
  const fichas: string[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    http: {
      async get(url) {
        fichas.push(url);
        const html = (fixture.fichas as Record<string, string>)[url];
        if (!html) throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text: html };
      },
      async post(url, json, init) {
        const args = (json as { params: { arguments: Call } }).params.arguments;
        calls.push(args);
        const page = (fixture.mcp as Record<string, unknown[]>)[args.category]?.[args.page - 1];
        if (!page || url !== "https://tienda.example/api/mcp" || !init?.accept?.includes("text/event-stream")) {
          throw new HttpError(url, 406);
        }
        return { status: 200, headers: new Headers(), text: JSON.stringify(page) };
      },
    },
  };
  return { ctx, calls, fichas };
}

describe("adaptador Jumpseller", () => {
  test("pagina el MCP y saca el precio tarjeta de la ficha; la transferencia es el descuento configurado", async () => {
    const adapter = createJumpsellerAdapter({
      baseUrl: "https://tienda.example",
      sku: "mpn",
      cashDiscount: 0.034,
      perPage: 2,
      categories: { gpu: ["equipos/componentes-informaticos/tarjetas-de-video"] },
    });
    const { ctx, calls } = fakeContext();
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));

    expect(calls.map((c) => c.page)).toEqual([1, 2]);
    expect(offers).toHaveLength(2);
    // La ficha muestra "$421.166 CLP" con transferencia y "$435.990 CLP" con otros medios de pago.
    expect(offers[0]).toMatchObject({
      externalId: "27580929",
      url: "https://notebookstore.cl/dual-rtx3060-o12g-v2",
      priceCash: 421_166,
      priceCard: 435_990,
      brand: "ASUS",
      mpn: "90YV0GB2-M0AA10",
      gtin: null,
      inStock: true,
    });
    // Un UPC en el SKU es GTIN, no MPN.
    expect(offers[1]).toMatchObject({ mpn: null, gtin: "824142126905" });
  });

  test("la promoción de la ficha manda sobre el MCP, sin pedir fichas de agotados ni caerse por un 404", async () => {
    const adapter = createJumpsellerAdapter({
      baseUrl: "https://tienda.example",
      sku: "mpn",
      perPage: 2,
      categories: { psu: ["hardware/fuentes-de-poder"] },
    });
    const { ctx, fichas } = fakeContext();
    const offers = await Array.fromAsync(adapter.crawlCategory("psu", ctx));

    // ATLAS 600: su ficha da 404 y se omite. ATLAS 650: agotado, sin ficha.
    expect(fichas).toEqual([
      "https://valrod.cl/fuente-de-poder-cougar-atlas-600",
      "https://valrod.cl/fuente-de-poder-cougar-atlas-750",
    ]);
    expect(offers.map((o) => [o.externalId, o.inStock, o.priceCash, o.priceCard])).toEqual([
      ["25055159", false, 84_990, null],
      // El MCP dice 74.990; la ficha, con la promoción, 54.990.
      ["25422286", true, 54_990, null],
    ]);
  });

  test("omite, sin pedir su ficha, los productos de una categoría excluida", async () => {
    const adapter = createJumpsellerAdapter({
      baseUrl: "https://tienda.example",
      sku: "mpn",
      perPage: 2,
      categories: { psu: ["hardware/fuentes-de-poder"] },
      exclude: { psu: ["Cougar"] },
    });
    const { ctx, fichas } = fakeContext();
    expect(await Array.fromAsync(adapter.crawlCategory("psu", ctx))).toEqual([]);
    expect(fichas).toEqual([]);
  });

  test("un SKU interno no se usa como MPN ni como GTIN", async () => {
    const adapter = createJumpsellerAdapter({
      baseUrl: "https://tienda.example",
      sku: "internal",
      perPage: 2,
      categories: { gpu: ["equipos/componentes-informaticos/tarjetas-de-video"] },
    });
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));
    expect(offers.map((o) => [o.mpn, o.gtin])).toEqual([
      [null, null],
      // El código de barras sí.
      [null, "824142126905"],
    ]);
  });
});
