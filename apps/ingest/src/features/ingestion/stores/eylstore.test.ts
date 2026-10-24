import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
// Cinco productos reales de `/api/categorias/…/productos` (11-10-2026), en dos páginas: sin código, con un número
// interno y part number, con un modelo con espacios, con un MPN y una placa con especificaciones y descripción
// (17-10-2026).
import responses from "./__fixtures__/eylstore.json";
import type { CrawlContext } from "./adapter";
import { createEylstoreAdapter } from "./eylstore";
import { HttpError } from "./http";

const BASE = "https://www.eylstore.cl";
const pages = responses as Record<string, string>;

const ctx: CrawlContext = {
  log: silentLogger,
  snapshot: async () => {},
  http: {
    async get(url) {
      const text = pages[url];
      if (text === undefined) throw new HttpError(url, 404);
      return { status: 200, headers: new Headers(), text };
    },
    post: async (url) => {
      throw new HttpError(url, 405);
    },
  },
};

const adapter = createEylstoreAdapter({ baseUrl: BASE, categories: { motherboard: ["placas-madres"] } });

describe("adaptador Eylstore", () => {
  test("pagina la API y lee precios, stock y fotos sin entrar a la ficha", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("motherboard", ctx));

    expect(offers).toHaveLength(5);
    expect(offers[1]).toMatchObject({
      externalId: "procesador-amd-ryzen-5-5500-42-ghz-6-nucleos-socket-am4-pn-100-100000457box",
      brand: "AMD",
      priceCash: 126_990,
      priceCard: 133_990,
      inStock: true,
      stockQuantity: 6,
    });
    expect(offers[1]?.url).toBe(`${BASE}/producto/${offers[1]?.externalId}`);
    expect(offers[1]?.imageUrls[0]).toStartWith("https://media.eylstore.cl/");
    expect(offers[2]).toMatchObject({ inStock: false, stockQuantity: 0 });
  });

  test("el MPN sale del part number o de un código sin espacios con letras y números", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("motherboard", ctx));
    // Sin código, "2232" con part number, "GV-N5090GAMING OC-32GD" (con espacios) y "G5060-8S2C".
    expect(offers.map((o) => o.mpn)).toEqual([null, "100-100000457box", null, "G5060-8S2C", null]);
  });

  test("el texto de ficha lleva las especificaciones antes que la descripción, sin el valor genérico 'Detalle'", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("motherboard", ctx));
    expect(offers[4]?.sourceText?.split("\n").slice(0, 6)).toEqual([
      "AMD AM5 – Ryzen™ 9000 / 8000 / 7000 Series",
      "AMD B850",
      "FCC, CE, ErP/EuP Ready",
      "Micro ATX (24.4 x 24.4 cm)",
      "12+2+1 Dr.MOS con disipador grande y capacitores 20K para mayor durabilidad",
      expect.stringMatching(/^La ASRock B850M Steel Legend WiFi combina rendimiento/),
    ]);
    expect(offers[4]?.sourceText).not.toContain("<");
    // Los otros cuatro vienen recortados sin descripción ni especificaciones.
    expect(offers[0]?.sourceText).toBeNull();
  });
});

test("refresco (#225): el mismo listado, sólo con las ofertas pedidas", async () => {
  const [, second] = await Array.fromAsync(adapter.crawlCategory("motherboard", ctx));
  if (!second) throw new Error("faltan ofertas en el fixture");
  const refs = [{ externalId: second.externalId, url: second.url, category: "motherboard" as const }];
  expect(await Array.fromAsync(adapter.refreshOffers?.(refs, ctx) ?? [])).toEqual([second]);
});
