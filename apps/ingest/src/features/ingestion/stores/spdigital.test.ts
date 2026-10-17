import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import type { RawOffer } from "../domain/normalize";
// Subcategoría de GPU Nvidia (page-data y tarjetas del HTML, oct. 2026), recortada a dos productos: una GPU en oferta
// y una fuente "Segunda selección" que no se rastrea. `product` es el page-data de la ficha de la GPU, sólo con la
// descripción.
import fixture from "./__fixtures__/spdigital.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { cardCashPrices, createSpDigitalAdapter, descriptionText } from "./spdigital";

const BASE = "https://www.spdigital.cl";
const SLUG = "componentes-tarjeta-de-video-tarjeta-video-nvidia";
const GPU = "tarjeta-de-video-zotac-nvidia-geforce-rtx-5060-ti-8gb-gddr7-twin-edge-oc-128bits-28gbps-pcie-50";
const FICHA = `${BASE}/page-data/${GPU}/page-data.json`;
const listingPages: Record<string, string> = {
  [`${BASE}/page-data/categories/${SLUG}/page-data.json`]: fixture.listing,
  [`${BASE}/categories/${SLUG}/`]: fixture.html,
};

function context(extra: Record<string, string> = {}, known?: Partial<RawOffer>) {
  const pages = { ...listingPages, ...extra };
  const requested: string[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    known: async (url) => (url === `${BASE}/${GPU}/` ? (known as RawOffer | undefined) : undefined),
    http: {
      async get(url) {
        requested.push(url);
        const text = pages[url];
        if (text === undefined) throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text };
      },
      post: async (url) => {
        throw new HttpError(url, 405);
      },
    },
  };
  return { ctx, requested };
}

async function crawl(ctx: CrawlContext) {
  const adapter = createSpDigitalAdapter({ baseUrl: BASE, categories: { gpu: [SLUG] } });
  const offers = [];
  for await (const offer of adapter.crawlCategory("gpu", ctx)) offers.push(offer);
  return offers;
}

describe("adaptador SP Digital", () => {
  test("las tarjetas del HTML traen el precio de transferencia por slug", () => {
    expect(cardCashPrices(fixture.html).get(GPU)).toBe(559_990);
  });

  test("une el page-data con la tarjeta: MPN, GTIN y stock del JSON, transferencia del HTML", async () => {
    const { ctx, requested } = context({ [FICHA]: fixture.product });
    const offers = await crawl(ctx);
    expect(requested).toContain(FICHA);
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
        sourceText: expect.stringMatching(/^Placa de video ZOTAC RTX 5060 Ti[\s\S]*\nNucleos CUDA 4608\n/),
      },
    ]);
  });

  test("sin el SEO que la tienda pega al final de la descripción", () => {
    const text = descriptionText(fixture.product);
    expect(text).toContain("Nucleos CUDA 4608");
    expect(text).not.toMatch(/Meta (Title|Description):/);
  });

  test("la oferta conocida con texto lo reusa sin pedir el page-data de la ficha", async () => {
    const { ctx, requested } = context({ [FICHA]: fixture.product }, { sourceText: "Guardado" });
    const [offer] = await crawl(ctx);
    expect(offer?.sourceText).toBe("Guardado");
    expect(requested).not.toContain(FICHA);
  });

  test("si la ficha falla, la oferta entra sin texto", async () => {
    const { ctx } = context();
    const [offer] = await crawl(ctx);
    expect(offer).toMatchObject({ externalId: "NA0000097521", sourceText: null });
  });

  test("una descripción que no es EditorJS da null", () => {
    const page = (description: string) => JSON.stringify({ result: { pageContext: { content: { description } } } });
    expect(descriptionText(page("<p>no es JSON</p>"))).toBeNull();
    expect(descriptionText(page('{"otra":"forma"}'))).toBeNull();
    expect(descriptionText(JSON.stringify({ result: {} }))).toBeNull();
    expect(descriptionText(page('{"blocks":[{"type":"list","data":{"items":["PCIe 5.0","8 GB"]}}]}'))).toBe(
      "PCIe 5.0\n8 GB",
    );
  });
});
