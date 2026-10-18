import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ApiErrorSchema, FacetListSchema, ProductDetailSchema, ProductPageSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { refreshSummaries, testEnv } from "./helpers";

/** Filtro por especificación, ofertas bajo el precio habitual y facetas; respuestas validadas contra contracts. */

let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
const get = (path: string) => app.request(path, undefined, env);
const list = async (qs: string) => ProductPageSchema.parse(await (await get(`/v1/products?${qs}`)).json());
const facets = async (slug: string, qs = "") =>
  FacetListSchema.parse(await (await get(`/v1/categories/${slug}/facets?${qs}`)).json()).items;
const facet = async (slug: string, key: string, qs = "") => (await facets(slug, qs)).find((f) => f.key === key);
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
  const references: [string, number | null][] = [];
  const seed = async (
    name: string,
    category: string,
    attributes: string,
    price: number,
    reference: number | null,
    inStock: 0 | 1 = 1,
  ) => {
    references.push([name.toLowerCase().replace(/\W+/g, "-"), reference]);
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
    const { id: listing } = await db.query
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
      .returning("id")
      .executeTakeFirstOrThrow();
    return listing;
  };
  const identity = (listing: number, version: number, specs: object, source: object) =>
    db.query
      .insertInto("listing_identity")
      .values({
        listing_id: listing,
        version,
        input_hash: `h${version}`,
        model: "m",
        category: "gpu",
        brand: null,
        name: "n",
        mpn: null,
        confidence: "high",
        identity: "{}",
        identity_raw: "{}",
        specs: JSON.stringify(specs),
        specs_source: JSON.stringify(source),
        created_at: at,
      })
      .execute();
  // Atributos como JSON crudo: así entran booleanos y reales (16.0) tal como los guardaría ingest.
  await seed("Placa A", "motherboard", '{"wifi":true,"memory":"ddr5","formFactor":"atx"}', 100_000, 110_000);
  await seed("Placa B", "motherboard", '{"wifi":false,"memory":"ddr5"}', 90_000, 92_000);
  await seed("Placa C", "motherboard", '{"wifi":true}', 80_000, 100_000);
  await seed("Placa D", "motherboard", '{"wifi":true,"memory":"ddr4"}', 70_000, null);
  await seed("Placa E", "motherboard", '{"wifi":true,"memory":"ddr5"}', 60_000, 90_000, 0);
  const gpu12 = await seed("GPU 12", "gpu", '{"chipset":"rtx 5070","vram":12}', 600_000, null);
  const gpu16 = await seed("GPU 16", "gpu", '{"chipset":"rtx 5070 ti","vram":16.0}', 800_000, null);
  const gpu8 = await seed("GPU 8", "gpu", '{"chipset":"rx 9060 xt","vram":8}', 300_000, null);
  await seed("GPU sin vram", "gpu", '{"chipset":"rtx 5070"}', 650_000, null);
  await seed("RAM CL16", "ram", '{"capacity":16,"casLatency":16}', 50_000, null);
  await seed("RAM CL30", "ram", '{"capacity":32,"casLatency":30}', 90_000, null);
  await seed("Fuente Bronze", "psu", '{"wattage":650,"efficiency":"bronze"}', 60_000, null);
  await seed("Fuente Gold", "psu", '{"wattage":850,"efficiency":"gold"}', 110_000, null);
  await seed("Fuente Platinum", "psu", '{"wattage":1000,"efficiency":"platinum"}', 180_000, null);
  // Specs por oferta: se escribe distinto entre tiendas, `knowledge` no filtra y manda la última versión.
  await identity(gpu12, 1, { memory_type: "GDDR6" }, { memory_type: "text" });
  await identity(
    gpu12,
    2,
    { memory_type: "gddr 7", length_mm: 245, slots: 2.5 },
    { memory_type: "text", length_mm: "text", slots: "text" },
  );
  // Hay tiendas que dejan el número dentro de un texto: SQLite lo lee igual al comparar.
  await identity(
    gpu16,
    1,
    { memory_type: "GDDR7", length_mm: "310 (con soporte)" },
    { memory_type: "text", length_mm: "text" },
  );
  await identity(gpu8, 1, { memory_type: "GDDR6" }, { memory_type: "knowledge" });
  await refreshSummaries(db);
  // El recálculo saca el precio habitual del historial diario, que aquí no existe: se vuelve a fijar el sembrado.
  for (const [slug, reference] of references) {
    await db.query.updateTable("products").set({ reference_price: reference }).where("slug", "=", slug).execute();
  }
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

  test("OR dentro de una clave y AND entre claves", async () => {
    expect(rows(await list("category=gpu&spec=chipset:rtx 5070&spec=chipset:rx 9060 xt&sort=price_asc"))).toEqual([
      ["GPU 8", "match"],
      ["GPU 12", "match"],
      ["GPU sin vram", "match"],
    ]);
    const page = await list("category=gpu&spec=chipset:rtx 5070&spec=chipset:rtx 5070 ti&spec=vram:12&sort=price_asc");
    expect(rows(page)).toEqual([
      ["GPU 12", "match"],
      ["GPU 16", "match"],
      ["GPU sin vram", "unknown"],
    ]);
    expect(page.specUnknown).toBe(1);
  });

  test("umbral mínimo: ese valor o más, con reales enteros como enteros y los sin dato al final", async () => {
    expect(rows(await list("category=gpu&spec=vram:12&sort=price_asc"))).toEqual([
      ["GPU 12", "match"],
      ["GPU 16", "match"],
      ["GPU sin vram", "unknown"],
    ]);
    expect(rows(await list("category=gpu&spec=vram:16&sort=price_asc"))).toEqual([
      ["GPU 16", "match"],
      ["GPU sin vram", "unknown"],
    ]);
    // Con varios valores manda el menos exigente.
    expect((await list("category=gpu&spec=vram:12&spec=vram:16")).total).toBe(3);
  });

  test("umbral máximo: ese valor o menos", async () => {
    expect(rows(await list("category=ram&spec=casLatency:16"))).toEqual([["RAM CL16", "match"]]);
    expect(rows(await list("category=ram&spec=casLatency:30&sort=price_asc"))).toEqual([
      ["RAM CL16", "match"],
      ["RAM CL30", "match"],
    ]);
  });

  test("umbral con escala: la certificación compara por posición, no por texto", async () => {
    expect(rows(await list("category=psu&spec=efficiency:gold&sort=price_asc"))).toEqual([
      ["Fuente Gold", "match"],
      ["Fuente Platinum", "match"],
    ]);
    expect((await list("category=psu&spec=efficiency:bronze")).total).toBe(3);
    expect(rows(await list("category=psu&spec=efficiency:gold&spec=wattage:900"))).toEqual([
      ["Fuente Platinum", "match"],
    ]);
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
    expect(page.total).toBe(13);
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
    const items = await facets("placas-madre");
    expect(items.map((f) => f.key)).toEqual([
      "socket",
      "chipset",
      "formFactor",
      "memory",
      "wifi",
      "m2_slots",
      "memory_slots",
      "memory_max_gb",
    ]);
    expect(items.slice(1, 5)).toEqual([
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
    const qs = "spec=memory:ddr5&spec=wifi:true";
    const [memory, wifi] = [await facet("placas-madre", "memory", qs), await facet("placas-madre", "wifi", qs)];
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
    const vram = await facet("tarjetas-de-video", "vram");
    // Es un umbral: cada valor cuenta los productos con ese valor o más.
    expect(vram).toEqual({
      key: "vram",
      label: "Memoria mínima",
      threshold: "min",
      values: [
        { value: "8", label: "8 GB o más", count: 3 },
        { value: "12", label: "12 GB o más", count: 2 },
        { value: "16", label: "16 GB o más", count: 1 },
      ],
      unknownCount: 1,
    });
    const memory = await facet("placas-madre", "memory", "deals=1");
    expect(memory).toMatchObject({ values: [{ value: "ddr5", count: 1 }], unknownCount: 1 });
    expect((await get("/v1/categories/placas-madre/facets?spec=vram:12")).status).toBe(400);
  });

  test("umbrales: el máximo cuenta hacia abajo, la escala de certificación en su orden, y se ignora el propio filtro", async () => {
    expect(await facet("memorias-ram", "casLatency")).toEqual({
      key: "casLatency",
      label: "Latencia máxima",
      threshold: "max",
      values: [
        { value: "16", label: "CL16 o menos", count: 1 },
        { value: "30", label: "CL30 o menos", count: 2 },
      ],
      unknownCount: 0,
    });
    expect((await facet("fuentes-de-poder", "efficiency"))?.values).toEqual([
      { value: "bronze", label: "80 Plus Bronze o superior", count: 3 },
      { value: "gold", label: "80 Plus Gold o superior", count: 2 },
      { value: "platinum", label: "80 Plus Platinum o superior", count: 1 },
    ]);
    // Con 850 W o más sólo quedan la Gold y la Platinum, y el filtro propio de la certificación no acota sus opciones.
    const efficiency = await facet("fuentes-de-poder", "efficiency", "spec=efficiency:platinum&spec=wattage:850");
    expect(efficiency?.values).toEqual([
      { value: "gold", label: "80 Plus Gold o superior", count: 2 },
      { value: "platinum", label: "80 Plus Platinum o superior", count: 1 },
    ]);
  });

  test("specs de las ofertas: sólo origen text, última versión, texto normalizado", async () => {
    expect(await facet("tarjetas-de-video", "memory_type")).toEqual({
      key: "memory_type",
      label: "Tipo de memoria",
      values: [{ value: "GDDR7", label: "GDDR7", count: 2 }],
      unknownCount: 2,
    });
    expect(rows(await list("category=gpu&spec=memory_type:GDDR7&sort=price_asc"))).toEqual([
      ["GPU 12", "match"],
      ["GPU 16", "match"],
      ["GPU 8", "unknown"],
      ["GPU sin vram", "unknown"],
    ]);
  });

  test("fabricante del chip derivado del chipset", async () => {
    expect((await facet("tarjetas-de-video", "chipMaker"))?.values).toEqual([
      { value: "nvidia", label: "NVIDIA", count: 3 },
      { value: "amd", label: "AMD", count: 1 },
    ]);
    expect(rows(await list("category=gpu&spec=chipMaker:amd"))).toEqual([["GPU 8", "match"]]);
  });

  test("escalones: las opciones son los escalones que alguien cumple, no cada largo medido", async () => {
    expect(await facet("tarjetas-de-video", "length_mm")).toEqual({
      key: "length_mm",
      label: "Largo máximo",
      threshold: "max",
      values: [
        { value: "250", label: "250 mm o menos", count: 1 },
        { value: "300", label: "300 mm o menos", count: 1 },
        { value: "330", label: "330 mm o menos", count: 2 },
        { value: "360", label: "360 mm o menos", count: 2 },
      ],
      unknownCount: 2,
    });
    expect(rows(await list("category=gpu&spec=length_mm:300&sort=price_asc"))).toEqual([
      ["GPU 12", "match"],
      ["GPU 8", "unknown"],
      ["GPU sin vram", "unknown"],
    ]);
    expect((await facet("tarjetas-de-video", "slots"))?.values).toEqual([
      { value: "2.5", label: "2,5 ranuras o menos", count: 1 },
      { value: "3", label: "3 ranuras o menos", count: 1 },
    ]);
  });
});
