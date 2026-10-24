import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
// Respuestas reales de la API de PC Factory (listado recortado a dos productos y una ficha).
import fixture from "./__fixtures__/pcfactory.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createPcFactoryAdapter } from "./pcfactory";

const API = "https://api.pcfactory.cl/pcfactory-services-catalogo/v1/catalogo/productos";

function fakeContext(items: unknown[] = fixture.query.content.items) {
  const requested: string[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    http: {
      async get(url) {
        requested.push(url);
        const body =
          url === `${API}/query?page=0&size=48&categorias=334,378,454`
            ? { content: { ...fixture.query.content, items } }
            : url === `${API}/56909`
              ? fixture.detail
              : null;
        if (!body) throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text: JSON.stringify(body) };
      },
      post: async (url) => {
        throw new HttpError(url, 405);
      },
    },
  };
  return { ctx, requested };
}

describe("adaptador PC Factory", () => {
  const adapter = createPcFactoryAdapter({ categories: { gpu: ["334", "378", "454"] } });

  test("lista por categorías, pide la ficha por el MPN y mapea los dos precios", async () => {
    const { ctx, requested } = fakeContext();
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));

    expect(requested).toEqual([`${API}/query?page=0&size=48&categorias=334,378,454`, `${API}/56909`, `${API}/54708`]);
    expect(offers[0]).toMatchObject({
      externalId: "56909",
      url: "https://www.pcfactory.cl/producto/56909-zotac-tarjeta-de-video-nvidia-geforce-rtx-3050-6gb-twin-edge-gaming",
      priceCash: 349_990,
      // "Otros medios de pago"; el "antes" (referencia 499.990) no se usa.
      priceCard: 360_790,
      brand: "Zotac",
      mpn: "ZT-A30510H-10A",
      inStock: true,
      // "+100" es un piso.
      stockQuantity: null,
      imageUrls: ["https://assets.pcfactory.cl/public/foto/56909/1_200.jpg"],
      // Descripción sin HTML y specs de la ficha, para el normalizador.
      sourceText:
        "Tarjeta de video ZOTAC GAMING GeForce RTX 3050 6GB Twin Edge con refrigeración IceStorm 2.0\nMemoria: 6GB GDDR6\nBus: 96-bit",
    });
  });

  test("una ficha que falla deja la oferta sin MPN ni texto en vez de tumbar la categoría", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));
    expect(offers[1]).toMatchObject({
      externalId: "54708",
      mpn: null,
      sourceText: null,
      stockQuantity: 19,
      priceCash: 914_990,
    });
  });

  test("salta los productos outlet", async () => {
    const [first] = fixture.query.content.items;
    const { ctx, requested } = fakeContext([{ ...first, outlet: true }]);
    expect(await Array.fromAsync(adapter.crawlCategory("gpu", ctx))).toEqual([]);
    expect(requested).toHaveLength(1);
  });
});

describe("refresco por listado (#121 fase 4)", () => {
  test("recorre el listado de la categoría sin pedir fichas y entrega sólo las ofertas pedidas", async () => {
    const adapter = createPcFactoryAdapter({ categories: { gpu: ["334", "378", "454"] } });
    const { ctx, requested } = fakeContext();
    const refs = [
      { externalId: "54708", url: "https://www.pcfactory.cl/producto/54708", category: "gpu" as const },
      { externalId: "1", url: "https://www.pcfactory.cl/producto/1", category: "gpu" as const },
    ];
    const offers = await Array.fromAsync(adapter.refreshOffers?.(refs, ctx) ?? []);
    expect(requested).toEqual([`${API}/query?page=0&size=48&categorias=334,378,454`]);
    expect(offers.map((o) => [o.externalId, o.priceCash, o.stockQuantity])).toEqual([["54708", 914_990, 19]]);
  });
});
