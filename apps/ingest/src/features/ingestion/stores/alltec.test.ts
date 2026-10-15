import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import { normalizeOffer } from "../domain/normalize";
// Listados y fichas reales de AllTec (11-10-2026), recortados a los bloques que se leen. 64-nvidia se partió en dos
// páginas para probar la paginación; 63-amd repite 2350 y trae 1897 sin ficha (simula un producto retirado, 404).
import responses from "./__fixtures__/alltec.json";
import type { CrawlContext } from "./adapter";
import { createAlltecAdapter, toRawOffer } from "./alltec";
import { HttpError } from "./http";

const BASE = "https://www.alltec.cl";
const pages = responses as Record<string, string>;

function fakeContext() {
  const urls: string[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    http: {
      async get(url) {
        urls.push(url);
        const text = pages[url];
        if (text === undefined) throw new HttpError(url, 404);
        return { status: 200, headers: new Headers(), text };
      },
      post: async (url) => {
        throw new HttpError(url, 405);
      },
    },
  };
  return { ctx, urls };
}

const adapter = createAlltecAdapter({ baseUrl: BASE, categories: { gpu: ["64-nvidia", "63-amd"] } });
const crawl = (ctx = fakeContext().ctx) => Array.fromAsync(adapter.crawlCategory("gpu", ctx));
const STRIX = `${BASE}/nvidia/2350-tv-asus-rog-strix-geforce-rtx-3070-ti-8g-gaming.html`;

describe("adaptador AllTec", () => {
  test("pagina con ?p=, entra una vez a cada ficha y salta la que ya no existe", async () => {
    const { ctx, urls } = fakeContext();
    const offers = await crawl(ctx);

    expect(urls.filter((u) => !u.endsWith(".html"))).toEqual([
      `${BASE}/64-nvidia`,
      `${BASE}/64-nvidia?p=2`,
      `${BASE}/63-amd`,
    ]);
    expect(urls.filter((u) => u === STRIX)).toHaveLength(1);
    expect(offers.map((o) => o.externalId)).toEqual(["1824", "2350", "2417"]);
  });

  test("MPN de la referencia, stock en unidades y el precio WEBPAY como tarjeta", async () => {
    const [gtx, strix, msi] = await crawl();
    expect(strix).toMatchObject({
      url: STRIX,
      title: "T.V. ASUS ROG STRIX GEFORCE RTX 3070 TI 8G GAMING",
      priceCash: 819_900,
      priceCard: 848_596,
      inStock: true,
      stockQuantity: 2,
      mpn: "ROG-STRIX-RTX3070TI-8G-GAMING",
      gtin: null,
      brand: null,
    });
    expect(strix?.imageUrls).toEqual([
      "https://www.alltec.cl/12195-large_default/tv-asus-rog-strix-geforce-rtx-3070-ti-8g-gaming.jpg",
    ]);
    expect(msi).toMatchObject({ title: "T.V. MSI GeForce RTX™ 5060 Ti 8G GAMING OC", mpn: "G506T-8GC" });
    expect(gtx).toMatchObject({ inStock: false, stockQuantity: 0, mpn: "GV-N1660OC-6GD" });
    // La marca no viene en la ficha: normalize la saca del título ("T.V. ASUS ...").
    const normalized = strix && normalizeOffer(strix, "gpu");
    expect(normalized?.ok && normalized.offer.brand).toBe("ASUS");
  });

  test("sin el precio WEBPAY la tarjeta es transferencia +3,5 %; una referencia GTIN va como GTIN", () => {
    // `content` con decimales se ve en fichas reales (2254): manda el texto.
    const html = (pages[STRIX] ?? "")
      .replace(/<p class="unit-price">[\s\S]*?<\/p>/, "")
      .replace('content="819900"', 'content="819900.000001"');
    expect(toRawOffer(html, "2350", STRIX, "gpu")).toMatchObject({ priceCash: 819_900, priceCard: 848_596 });
    const ean = (pages[STRIX] ?? "").replace(/ROG-STRIX-RTX3070TI-8G-GAMING/g, "4719512073520");
    expect(toRawOffer(ean, "2350", STRIX, "gpu")).toMatchObject({ mpn: null, gtin: "4719512073520" });
  });
});
