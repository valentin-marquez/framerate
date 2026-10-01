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
    });
  });

  test("una ficha que falla deja la oferta sin MPN en vez de tumbar la categoría", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));
    expect(offers[1]).toMatchObject({ externalId: "54708", mpn: null, stockQuantity: 19, priceCash: 914_990 });
  });

  test("salta los productos outlet", async () => {
    const [first] = fixture.query.content.items;
    const { ctx, requested } = fakeContext([{ ...first, outlet: true }]);
    expect(await Array.fromAsync(adapter.crawlCategory("gpu", ctx))).toEqual([]);
    expect(requested).toHaveLength(1);
  });
});
