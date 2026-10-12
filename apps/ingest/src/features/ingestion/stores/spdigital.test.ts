import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
// Subcategoría de GPU Nvidia (page-data y tarjetas del HTML, oct. 2026), recortada a dos productos: una GPU en oferta
// y una fuente "Segunda selección" que no se rastrea.
import fixture from "./__fixtures__/spdigital.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { cardCashPrices, createSpDigitalAdapter } from "./spdigital";

const BASE = "https://www.spdigital.cl";
const SLUG = "componentes-tarjeta-de-video-tarjeta-video-nvidia";
const GPU = "tarjeta-de-video-zotac-nvidia-geforce-rtx-5060-ti-8gb-gddr7-twin-edge-oc-128bits-28gbps-pcie-50";
const pages: Record<string, string> = {
  [`${BASE}/page-data/categories/${SLUG}/page-data.json`]: fixture.listing,
  [`${BASE}/categories/${SLUG}/`]: fixture.html,
};

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

describe("adaptador SP Digital", () => {
  test("las tarjetas del HTML traen el precio de transferencia por slug", () => {
    expect(cardCashPrices(fixture.html).get(GPU)).toBe(559_990);
  });

  test("une el page-data con la tarjeta: MPN, GTIN y stock del JSON, transferencia del HTML", async () => {
    const adapter = createSpDigitalAdapter({ baseUrl: BASE, categories: { gpu: [SLUG] } });
    const offers = [];
    for await (const offer of adapter.crawlCategory("gpu", ctx)) offers.push(offer);
    expect(offers).toEqual([
      {
        externalId: "NA0000097521",
        url: `${BASE}/${GPU}/`,
        title: "Tarjeta de video ZOTAC NVIDIA GeForce RTX 5060 Ti 8GB GDDR7 Twin Edge OC 128bits 28Gbps PCIe 5.0",
        category: "gpu",
        priceCash: 559_990,
        priceCard: 585_195,
        inStock: true,
        stockQuantity: 2,
        brand: "ZOTAC",
        mpn: "ZT-B50610H-10A",
        gtin: "810012086714",
        imageUrls: expect.arrayContaining([expect.stringContaining("media.spdigital.cl")]),
      },
    ]);
  });
});
