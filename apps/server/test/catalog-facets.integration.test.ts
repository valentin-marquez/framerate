import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ApiErrorSchema, FacetListSchema, ProductDetailSchema, ProductPageSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { testEnv } from "./helpers";

/** Filtro por especificación, ofertas bajo el precio habitual y facetas; respuestas validadas contra contracts. */

let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
const get = (path: string) => app.request(path, undefined, env);
const list = async (qs: string) => ProductPageSchema.parse(await (await get(`/v1/products?${qs}`)).json());
const facets = async (slug: string, qs = "") =>
  FacetListSchema.parse(await (await get(`/v1/categories/${slug}/facets?${qs}`)).json()).items;
const rows = (page: { items: { name: string; specMatch?: string }[] }) => page.items.map((p) => [p.name, p.specMatch]);

beforeAll(async () => {
  let d1: D1Database;
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
  const at = new Date().toISOString();
  const { id: store } = await db.query
    .insertInto("stores")
    .values({ slug: "alfa", name: "alfa", url: "https://alfa.cl", domain: "alfa.cl", created_at: at })
    .returning("id")
    .executeTakeFirstOrThrow();
  const seed = async (
    name: string,
    category: string,
    attributes: string,
    price: number,
    reference: number | null,
    inStock: 0 | 1 = 1,
  ) => {
    const { id } = await db.query
      .insertInto("products")
      .values({
        slug: name.toLowerCase().replace(/\W+/g, "-"),
        name,
        category,
        brand: "Marca",
        attributes,
        reference_price: reference,
        created_at: at,
        updated_at: at,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db.query
      .insertInto("listings")
      .values({
        store_id: store,
        product_id: id,
        external_id: name,
        url: `https://alfa.cl/${id}`,
        title: name,
        category,
        price_cash: price,
        price_card: price,
        in_stock: inStock,
        first_seen_at: at,
        last_seen_at: at,
        updated_at: at,
      })
      .execute();
  };
  // Atributos como JSON crudo: así entran booleanos y reales (16.0) tal como los guardaría ingest.
  await seed("Placa A", "motherboard", '{"wifi":true,"memory":"ddr5","formFactor":"atx"}', 100_000, 110_000);
  await seed("Placa B", "motherboard", '{"wifi":false,"memory":"ddr5"}', 90_000, 92_000);
  await seed("Placa C", "motherboard", '{"wifi":true}', 80_000, 100_000);
  await seed("Placa D", "motherboard", '{"wifi":true,"memory":"ddr4"}', 70_000, null);
  await seed("Placa E", "motherboard", '{"wifi":true,"memory":"ddr5"}', 60_000, 90_000, 0);
  await seed("GPU 12", "gpu", '{"chipset":"rtx 5070","vram":12}', 600_000, null);
  await seed("GPU 16", "gpu", '{"chipset":"rtx 5070 ti","vram":16.0}', 800_000, null);
  await seed("GPU 8", "gpu", '{"chipset":"rtx 5060","vram":8}', 300_000, null);
  await seed("GPU sin vram", "gpu", '{"chipset":"rtx 5070"}', 650_000, null);
});
afterAll(() => dispose());

describe("filtro por especificación", () => {
  test("excluye a los que no cumplen y deja al final a los sin dato, en el orden pedido", async () => {
    const page = await list("category=motherboard&spec=memory:ddr5&sort=price_asc");
    // D (ddr4) fuera; C sin el dato al final; E sin stock no aparece.
    expect(rows(page)).toEqual([
      ["Placa B", "match"],
      ["Placa A", "match"],
      ["Placa C", "unknown"],
    ]);
    expect(page).toMatchObject({ total: 3, specUnknown: 1 });
  });

  test("booleanos: wifi:true y wifi:false", async () => {
    expect(rows(await list("category=motherboard&spec=wifi:true&sort=price_asc"))).toEqual([
      ["Placa D", "match"],
      ["Placa C", "match"],
      ["Placa A", "match"],
    ]);
    expect(rows(await list("category=motherboard&spec=wifi:false"))).toEqual([["Placa B", "match"]]);
  });

  test("OR dentro de una clave, AND entre claves, y reales enteros como enteros", async () => {
    expect(rows(await list("category=gpu&spec=vram:12&spec=vram:16&sort=price_asc"))).toEqual([
      ["GPU 12", "match"],
      ["GPU 16", "match"],
      ["GPU sin vram", "unknown"],
    ]);
    const page = await list("category=gpu&spec=vram:12&spec=vram:16&spec=chipset:rtx 5070&sort=price_asc");
    expect(rows(page)).toEqual([
      ["GPU 12", "match"],
      ["GPU sin vram", "unknown"],
    ]);
    expect(page.specUnknown).toBe(1);
  });

  test("sin spec no hay specMatch ni specUnknown; referencePrice en listado y ficha", async () => {
    const page = await list("category=motherboard&sort=name");
    expect(page.specUnknown).toBeUndefined();
    expect(page.items.map((p) => [p.specMatch, p.referencePrice])).toEqual([
      [undefined, 110_000],
      [undefined, 92_000],
      [undefined, 100_000],
      [undefined, null],
    ]);
    const detail = ProductDetailSchema.parse(await (await get("/v1/products/placa-a")).json());
    expect(detail.referencePrice).toBe(110_000);
  });

  test("clave que no es faceta de la categoría: 400; sin categoría se ignora", async () => {
    const res = await get("/v1/products?category=motherboard&spec=vram:12");
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("invalid_request");
    const page = await list("spec=nada:1");
    expect(page.total).toBe(8);
    expect(page.specUnknown).toBeUndefined();
  });
});

describe("ofertas", () => {
  test("deals deja los con stock al menos 3 % bajo su referencia; discount ordena por baja en pesos", async () => {
    // B baja sólo 2,2 %; E sin stock; D sin referencia.
    expect(rows(await list("deals=1&sort=discount"))).toEqual([
      ["Placa C", undefined],
      ["Placa A", undefined],
    ]);
    expect(rows(await list("deals=1&category=motherboard&spec=memory:ddr5"))).toEqual([
      ["Placa A", "match"],
      ["Placa C", "unknown"],
    ]);
  });

  test("discount sin deals: los sin referencia al final", async () => {
    expect((await list("category=motherboard&sort=discount")).items.map((p) => p.name)).toEqual([
      "Placa C",
      "Placa A",
      "Placa B",
      "Placa D",
    ]);
  });
});

describe("facetas", () => {
  test("conteos sólo con stock, con unknownCount y etiquetas", async () => {
    expect(await facets("placas-madre")).toEqual([
      { key: "chipset", label: "Chipset", values: [], unknownCount: 4 },
      { key: "formFactor", label: "Formato", values: [{ value: "atx", label: "ATX", count: 1 }], unknownCount: 3 },
      {
        key: "memory",
        label: "Memoria",
        values: [
          { value: "ddr5", label: "DDR5", count: 2 },
          { value: "ddr4", label: "DDR4", count: 1 },
        ],
        unknownCount: 1,
      },
      {
        key: "wifi",
        label: "Wi-Fi",
        values: [
          { value: "true", label: "Con Wi-Fi", count: 3 },
          { value: "false", label: "Sin Wi-Fi", count: 1 },
        ],
        unknownCount: 0,
      },
    ]);
  });

  test("cada faceta ignora su propio filtro y aplica los demás", async () => {
    const [, , memory, wifi] = await facets("placas-madre", "spec=memory:ddr5&spec=wifi:true");
    // memory: sólo wifi:true (A, C, D); wifi: memory ddr5 o desconocida (A, B, C).
    expect(memory).toMatchObject({
      values: [
        { value: "ddr4", count: 1 },
        { value: "ddr5", count: 1 },
      ],
      unknownCount: 1,
    });
    expect(wifi).toMatchObject({
      values: [
        { value: "true", count: 2 },
        { value: "false", count: 1 },
      ],
      unknownCount: 0,
    });
  });

  test("valores con unidad en orden numérico, con deals y 400 por clave ajena", async () => {
    const [vram] = await facets("tarjetas-de-video");
    expect(vram).toEqual({
      key: "vram",
      label: "Memoria",
      values: [
        { value: "8", label: "8 GB", count: 1 },
        { value: "12", label: "12 GB", count: 1 },
        { value: "16", label: "16 GB", count: 1 },
      ],
      unknownCount: 1,
    });
    const [, , memory] = await facets("placas-madre", "deals=1");
    expect(memory).toMatchObject({ values: [{ value: "ddr5", count: 1 }], unknownCount: 1 });
    expect((await get("/v1/categories/placas-madre/facets?spec=vram:12")).status).toBe(400);
  });
});
