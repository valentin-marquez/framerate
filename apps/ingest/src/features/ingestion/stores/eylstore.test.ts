import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
// Cuatro productos reales de `/api/categorias/…/productos` (11-10-2026), en dos páginas: sin código, con un número
// interno y part number, con un modelo con espacios y con un MPN.
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

    expect(offers).toHaveLength(4);
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
    expect(offers.map((o) => o.mpn)).toEqual([null, "100-100000457box", null, "G5060-8S2C"]);
  });
});
