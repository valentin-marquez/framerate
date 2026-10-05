import { describe, expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
// Respuesta real del listado de Tecno Saga (oct. 2026, categoría 8/91), con tres productos.
import page from "./__fixtures__/tecnosaga.json";
import type { CrawlContext } from "./adapter";
import { createTecnoSagaAdapter } from "./tecnosaga";

function fakeContext(body: unknown) {
  const calls: { url: string; body: unknown; headers?: Record<string, string> }[] = [];
  const ctx: CrawlContext = {
    log: silentLogger,
    snapshot: async () => {},
    http: {
      get: async () => {
        throw new Error("sin GET");
      },
      async post(url, json, init) {
        calls.push({ url, body: json, headers: init?.headers });
        return { status: 200, headers: new Headers(), text: JSON.stringify(body) };
      },
    },
  };
  return { ctx, calls };
}

const adapter = createTecnoSagaAdapter({ baseUrl: "https://tecnosaga.cl", categories: { gpu: ["8/91"] } });

describe("adaptador Tecno Saga", () => {
  test("pide el listado por formulario con X-Requested-With", async () => {
    const { ctx, calls } = fakeContext(page);
    await Array.fromAsync(adapter.crawlCategory("gpu", ctx));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://tecnosaga.cl/productos/listadoajax");
    expect(calls[0]?.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    });
    const form = new URLSearchParams(String(calls[0]?.body));
    expect(form.get("id_categoria")).toBe("8");
    expect(form.get("id_subcategoria")).toBe("91");
    expect(form.get("pagina")).toBe("1");
  });

  test("transferencia, tarjeta, marca y stock sumado de las tres sucursales", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext(page).ctx));

    expect(offers).toHaveLength(3);
    expect(offers[0]).toMatchObject({
      priceCash: 165_900,
      priceCard: 174_195,
      brand: "GIGABYTE",
      inStock: false,
      stockQuantity: 0,
    });
    expect(offers[1]).toMatchObject({ priceCash: 219_900, priceCard: 230_895, inStock: true, stockQuantity: 1 });
    // El SKU es interno y no hay MPN: lo único que se entrega es el título.
    expect(offers.every((o) => o.mpn === null && o.gtin === null)).toBe(true);
    expect(offers[0]?.url).toStartWith("https://tecnosaga.cl/productos/detalle/");
    expect(offers[0]?.imageUrls[0]).toStartWith("https://tecnosaga.cl/images/productos/");
  });

  test("una subcategoría vacía (`productos: false`) no rinde ofertas ni falla", async () => {
    const offers = await Array.fromAsync(adapter.crawlCategory("gpu", fakeContext({ productos: false }).ctx));
    expect(offers).toEqual([]);
  });
});
