import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
// Listado y fichas reales de Wei (oct. 2026), recortados a los bloques que se leen. La ficha del tercer producto falta
// a propósito: simula un producto retirado entre el listado y la ficha (404).
import responses from "./__fixtures__/wei.json";
import type { CrawlContext } from "./adapter";
import { HttpError } from "./http";
import { createWeiAdapter } from "./wei";

const BASE = "https://www.wei.cl";
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

const adapter = createWeiAdapter({ baseUrl: BASE, categories: { gpu: ["1305"] } });

describe("adaptador Wei", () => {
  test("lee el listado, entra a cada ficha y salta la que ya no existe", async () => {
    const { ctx, urls } = fakeContext();
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", ctx));

    expect(urls[0]).toBe(`${BASE}/categoria/1305?view=icon&perpage=100&page=0&order=disponibilidad`);
    expect(urls).toHaveLength(4); // el listado y tres fichas (una da 404)
    expect(offers.map((o) => o.externalId)).toEqual(["TVMSI00211", "6511C3201D"]);
  });

  test("ficha: marca del título, Part Number, transferencia, tarjeta y unidades", async () => {
    const [n210, gt1030] = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext().ctx));

    expect(n210).toMatchObject({
      brand: "MSI",
      mpn: "N210-MD1G/D3",
      priceCash: 39_890,
      priceCard: 41_989,
      inStock: true,
      stockQuantity: 21,
    });
    expect(n210?.imageUrls).toEqual(["https://www.wei.cl/img/product/TVMSI00211g.jpeg"]);
    expect(gt1030).toMatchObject({ mpn: "912-V812-231", brand: "MSI" });
  });
});
