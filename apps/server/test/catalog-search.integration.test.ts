import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ProductPageSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1 } from "@framerate/database/testing";
import { searchText } from "@framerate/kit";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { refreshSummaries, testEnv } from "./helpers";

/** Buscar un modelo pegado o separado encuentra lo mismo (#129). */

let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
const found = async (q: string) => {
  const page = ProductPageSchema.parse(
    await (await app.request(`/v1/products?q=${encodeURIComponent(q)}&limit=50`, undefined, env)).json(),
  );
  return page.items.map((p) => p.name).sort();
};

const TI = ["ASUS PRIME RTX 5070 Ti 16GB GDDR7", "Gigabyte RTX 5070 TI EAGLE OC", "MSI RTX 5070Ti 16G FRIEREN"];

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
  let n = 0;
  const seed = async (name: string, category: string) => {
    const { id } = await db.query
      .insertInto("products")
      .values({
        slug: `p-${++n}`,
        name,
        search: searchText(name),
        category,
        brand: name.split(" ")[0] ?? null,
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
        external_id: `l-${n}`,
        url: `https://alfa.cl/p/${n}`,
        title: name,
        category,
        price_cash: 100_000 + n,
        price_card: 100_000 + n,
        in_stock: 1,
        first_seen_at: at,
        last_seen_at: at,
        updated_at: at,
      })
      .execute();
  };
  for (const name of TI) await seed(name, "gpu");
  await seed("ASUS DUAL RTX 5070 OC 12GB", "gpu");
  await seed("ASUS DUAL RX 7800XT OC 16GB", "gpu");
  await seed("Sapphire PULSE RX 7800 XT 16GB", "gpu");
  await seed("Kingston FURY Beast 16GB DDR5-6000", "ram");
  await seed("Corsair Vengeance 16 GB DDR5 6000", "ram");
  await seed("AMD Ryzen 7 7800X3D", "cpu");
  await seed("Intel Core i5-12400F", "cpu");
  await refreshSummaries(db);
});
afterAll(() => dispose());

describe("búsqueda de un modelo escrito pegado o separado", () => {
  test("las cuatro formas de escribir 5070 Ti encuentran las tres", async () => {
    for (const q of ["5070ti", "5070 ti", "rtx 5070ti", "rtx5070ti"]) {
      expect(await found(q)).toEqual(TI);
    }
  });

  test("buscar 5070 Ti no trae la 5070 sin Ti", async () => {
    expect(await found("5070 ti")).not.toContain("ASUS DUAL RTX 5070 OC 12GB");
  });

  test("buscar 5070 sigue trayendo las dos, como antes", async () => {
    expect(await found("5070")).toEqual([...TI, "ASUS DUAL RTX 5070 OC 12GB"].sort());
  });

  test("7800XT y 16GB también dejan de depender de cómo lo escribió la tienda", async () => {
    const xt = ["ASUS DUAL RX 7800XT OC 16GB", "Sapphire PULSE RX 7800 XT 16GB"];
    expect(await found("7800xt")).toEqual(xt);
    expect(await found("7800 xt")).toEqual(xt);
    expect(await found("16gb")).toContain("Corsair Vengeance 16 GB DDR5 6000");
    expect(await found("16 gb")).toContain("ASUS DUAL RX 7800XT OC 16GB");
  });

  test("no se rompen los modelos donde separar sería un error", async () => {
    expect(await found("7800x3d")).toEqual(["AMD Ryzen 7 7800X3D"]);
    expect(await found("i5-12400f")).toEqual(["Intel Core i5-12400F"]);
    expect(await found("ddr5 6000")).toEqual([
      "Corsair Vengeance 16 GB DDR5 6000",
      "Kingston FURY Beast 16GB DDR5-6000",
    ]);
    expect(await found("ddr5-6000")).toEqual([
      "Corsair Vengeance 16 GB DDR5 6000",
      "Kingston FURY Beast 16GB DDR5-6000",
    ]);
  });
});
