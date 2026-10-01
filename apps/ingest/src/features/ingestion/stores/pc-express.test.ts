import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import { silentLogger } from "@framerate/kit";
import { normalizeMpn } from "@framerate/matching";
import { normalizeOffer } from "../domain/normalize";
// Listados y fichas reales de PC Express (sept. 2026), recortados a los bloques que se leen. La ficha de 19237
// (página 2 de tarjetas de video) falta a propósito: simula un producto despublicado (404).
import responses from "./__fixtures__/pc-express.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createPcExpressAdapter, toRawOffer } from "./pc-express";

const BASE = "https://tienda.pc-express.cl";
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

const adapter = createPcExpressAdapter({
  baseUrl: BASE,
  categories: { gpu: ["475", "602"], cpu: ["591"], case: ["120"], case_fan: ["170"] },
});
const crawl = (category: Category, ctx = fakeContext().ctx) => Array.fromAsync(adapter.crawlCategory(category, ctx));
const listing = (path: string, page = "") => `${BASE}/index.php?route=product/category&path=${path}${page}`;

describe("adaptador PC Express", () => {
  test("pagina el listado, entra una vez a cada ficha y salta la que ya no existe", async () => {
    const { ctx, urls } = fakeContext();
    const offers = await crawl("gpu", ctx);

    expect(urls.filter((u) => u.includes("route=product/category"))).toEqual([
      listing("475"),
      listing("475", "&page=2"),
      listing("602"),
    ]);
    // 21178 está en 475 y en 602 (Intel Arc): una sola ficha.
    expect(urls.filter((u) => u.includes("/21178-"))).toHaveLength(1);
    expect(offers.map((o) => o.externalId)).toEqual(["8680", "21178", "19900"]);
  });

  test("transferencia y 'Otros medios' (tarjeta), sin el precio 'Normal' tachado", async () => {
    const [bridge, , arc] = await crawl("gpu");
    expect(bridge).toMatchObject({ priceCash: 9_900, priceCard: 10_532 });
    expect(arc).toMatchObject({
      externalId: "19900",
      url: `${BASE}/19900-tarjeta-de-video-asrock-intel-arc-b580-challenger-gaming-12gb-gddr6-192-bit-p-n-90-ga5lzz-00uanf`,
      title: "TARJETA DE VIDEO ASROCK INTEL ARC B580 CHALLENGER GAMING 12GB GDDR6 192 BIT P/N 90-ga5lzz-00uanf",
      priceCash: 398_900,
      priceCard: 424_362,
      brand: "ASROCK",
      mpn: "90-GA5LZZ-00UANF",
      gtin: null,
      inStock: true,
      stockQuantity: 14,
    });
    expect(arc?.imageUrls).toEqual([
      "https://alerce.alcosto.cl/img/20250211_135118_1.png?fit=fill-max&bg=fff&s=e6946a99b4bf9f3f131b8ed5d1450518&p=large",
    ]);
    expect(normalizeOffer(bridge, "gpu")).toMatchObject({ ok: false, reason: "price:out_of_range" });
  });

  test("un MPN corto ('A380') llega crudo pero no entra a la huella", async () => {
    const [, a380] = await crawl("gpu");
    expect(a380).toMatchObject({ externalId: "21178", mpn: "A380", priceCash: 178_900, priceCard: 190_319 });
    expect(normalizeMpn(a380?.mpn)).toBeNull();
  });

  test("stock de casa matriz cuenta aunque la web (y el JSON-LD) digan agotado", async () => {
    const [ryzen] = await crawl("cpu");
    expect(ryzen).toMatchObject({
      externalId: "20561",
      inStock: true,
      stockQuantity: 2,
      mpn: "100-100000718BOX",
      priceCash: 238_900,
      priceCard: 254_149,
    });
  });

  test("sin unidades en ninguna sucursal queda sin stock; sin bloque de stock manda el JSON-LD", () => {
    const url = `${BASE}/20561-procesador-amd-ryzen-5-9600-3800-5200-6core-sam5`;
    const html = pages[url] ?? "";
    expect(toRawOffer(html.replace("2 unidades", "Sin stock"), "20561", url, "cpu")).toMatchObject({
      inStock: false,
      stockQuantity: 0,
    });
    expect(toRawOffer(html.replace(/id="stock-sucursal-\d+"/g, ""), "20561", url, "cpu")).toMatchObject({
      inStock: false,
      stockQuantity: 0,
    });
  });

  test("un UPC en el campo MPN es GTIN y un MPN con espacios (el título copiado) se descarta", async () => {
    const [gamemax, antec] = await crawl("case");
    expect(gamemax).toMatchObject({ externalId: "20668", brand: "GAMEMAX", mpn: null, gtin: null });
    expect(antec).toMatchObject({ externalId: "20479", mpn: null, gtin: "0-761345-10136-3" });
  });

  test("'+20 unidades' es stock sin cantidad exacta", async () => {
    const [fan] = await crawl("case_fan");
    expect(fan).toMatchObject({ externalId: "2085", inStock: true, stockQuantity: null, priceCash: 1_000 });
  });
});
