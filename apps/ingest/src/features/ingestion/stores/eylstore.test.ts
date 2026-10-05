import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
// Cuatro `<article>` reales de Eylstore (oct. 2026): sin código, con un número interno, con un modelo con espacios y
// con un MPN. El RSC de la página trae `last_page`.
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
  test("lee las tarjetas del listado, sin entrar a la ficha", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("motherboard", ctx));

    expect(offers).toHaveLength(4);
    expect(offers[0]).toMatchObject({
      brand: "ASROCK",
      priceCash: 218_980,
      priceCard: 229_929,
      inStock: true,
      stockQuantity: 4,
    });
    expect(offers[0]?.url).toStartWith(`${BASE}/producto/placa-madre-asrock-b850m`);
    expect(offers[0]?.imageUrls[0]).toStartWith("https://media.eylstore.cl/");
  });

  test("sólo un código sin espacios con letras y números es MPN", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("motherboard", ctx));
    // "SKU no informado", "2417" (interno), "A520M K V2" (modelo con espacios) y "G5060-8S2C".
    expect(offers.map((o) => o.mpn)).toEqual([null, null, null, "G5060-8S2C"]);
  });
});
