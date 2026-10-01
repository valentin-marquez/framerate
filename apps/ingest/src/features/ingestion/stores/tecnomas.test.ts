import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import { normalizeOffer } from "../domain/normalize";
// Respuestas reales de Tecnomas recortadas: el ItemList de los dos listados de Procesadores, un listado vacío y fichas.
import pages from "./__fixtures__/tecnomas.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createTecnomasAdapter, toRawOffer } from "./tecnomas";

const BASE = "https://www.tecnomas.cl";
const fixture = pages as Record<string, string>;
const listing = (category: string, page: number) =>
  `${BASE}/productos?categorias=%5B${category}%5D&condicion=%5BNuevo%5D&mostrar=48&pagina=${page}`;

function fakeContext(override?: string) {
  const requests: { url: string; accept?: string }[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    http: {
      async get(url, init) {
        requests.push({ url, accept: init?.accept });
        const text = override ?? fixture[url];
        // Sólo hay algunas fichas guardadas: el resto responde como un producto retirado.
        if (text === undefined) throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text };
      },
      post: async (url) => {
        throw new HttpError(url, 405);
      },
    },
  };
  return { ctx, requests };
}

const adapter = createTecnomasAdapter({
  baseUrl: BASE,
  categories: { cpu: ["Procesadores"], gpu: ["Tarjetas de Video"] },
});
const ficha = (slug: string) => fixture[`${BASE}/producto/${slug}`] ?? "";

describe("adaptador Tecnomas", () => {
  test("lee las dos páginas del ItemList antes de entrar a cada ficha y salta las que ya no existen", async () => {
    const { ctx, requests } = fakeContext();
    const offers = await Array.fromAsync(adapter.crawlCategory("cpu", ctx));

    expect(requests.slice(0, 2).map((r) => r.url)).toEqual([listing("Procesadores", 1), listing("Procesadores", 2)]);
    // 48 + 32 productos: una ficha por cada uno, todo como HTML.
    expect(requests).toHaveLength(82);
    expect(requests.every((r) => r.accept === "text/html")).toBe(true);
    expect(offers.map((o) => o.externalId)).toEqual(["141711", "38131", "87310"]);
  });

  test("toma transferencia y Webpay, nunca el precio 'antes' tachado", async () => {
    const [offer] = await Array.fromAsync(adapter.crawlCategory("cpu", fakeContext().ctx));
    expect(offer).toMatchObject({
      externalId: "141711",
      url: `${BASE}/producto/100-100000743sbx`,
      title: "CPU AMD Ryzen 7 5700 3.7-4.6GHz Turbo 16MB L3 8 Núcleos Sckt AM4 s/Grf c/FAN",
      category: "cpu",
      // La ficha muestra también $ 219.990 y $ 225.990 tachados.
      priceCash: 158_990,
      priceCard: 162_990,
      brand: "AMD",
      mpn: "100-100000743SBX",
      gtin: "730143317856",
      inStock: true,
      // "más de 20 unidades" no es una cantidad.
      stockQuantity: null,
    });
    expect(normalizeOffer(offer, "cpu")).toMatchObject({ ok: true });
  });

  test("con un único precio ('Todo medio de pago') no hay precio tarjeta", () => {
    const offer = toRawOffer(
      ficha("cpu-intel-core-i5-14400f-14gth-2-5-4-7ghz-turbo-20mb-10-nucl-lga1700-c-grf-fan"),
      `${BASE}/producto/x`,
      "cpu",
    );
    expect(offer).toMatchObject({ priceCash: 214_990, priceCard: null, mpn: "BX8071514400F" });
  });

  test("'Solo 1 unidad' es la cantidad en stock", () => {
    const offer = toRawOffer(ficha("intel-core-ultra-9-285k-3-7-ghz-24-core-lga1851"), `${BASE}/producto/x`, "cpu");
    expect(offer).toMatchObject({ priceCash: 694_990, priceCard: 711_990, inStock: true, stockQuantity: 1 });
  });

  test("un UPC en el SKU es GTIN, no MPN", () => {
    const offer = toRawOffer(
      ficha("refrigeracion-liquida-msi-mag-coreliquid-m360-3-fan-lga1200-1700-am5-am4-tr4"),
      `${BASE}/producto/x`,
      "cpu_cooler",
    );
    expect(offer).toMatchObject({ mpn: null, gtin: "0824142306734", priceCash: 99_990, priceCard: 102_990 });
  });

  test("MPN, GTIN, fotos y la disponibilidad del JSON-LD", () => {
    const html = ficha("tarjeta-de-video-asus-dual-geforce-rtx-3060-oc");
    const offer = toRawOffer(html, `${BASE}/producto/x`, "gpu");
    expect(offer).toMatchObject({ mpn: "DUAL-RTX3060-O12G-V2", gtin: "195553309899", inStock: true, stockQuantity: 2 });
    expect(offer.imageUrls).toHaveLength(2);
    expect(normalizeOffer(offer, "gpu")).toMatchObject({ ok: true });

    const soldOut = toRawOffer(
      html.replace("schema.org/InStock", "schema.org/OutOfStock"),
      `${BASE}/producto/x`,
      "gpu",
    );
    expect(soldOut).toMatchObject({ inStock: false, stockQuantity: 0 });
  });

  test("un listado vacío no entrega ofertas; una página sin ItemList ni aviso de vacío falla", async () => {
    const { ctx, requests } = fakeContext();
    expect(await Array.fromAsync(adapter.crawlCategory("gpu", ctx))).toEqual([]);
    expect(requests.map((r) => r.url)).toEqual([listing("Tarjetas+de+Video", 1)]);

    await expect(Array.fromAsync(adapter.crawlCategory("gpu", fakeContext("<html></html>").ctx))).rejects.toThrow(
      "sin ItemList",
    );
  });
});
