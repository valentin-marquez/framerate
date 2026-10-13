import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ProductListQuerySchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1, resetD1 } from "@framerate/database/testing";
import { listBrands, listProducts } from "./catalog.queries";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const NOW = "2026-10-13T00:00:00.000Z";
const query = (q: Record<string, unknown>) => ProductListQuerySchema.parse({ category: "gpu", ...q });

async function seed() {
  const store = await db.query
    .insertInto("stores")
    .values({ slug: "beta", name: "beta", url: "https://beta.cl", domain: "beta.cl", created_at: NOW })
    .returning("id")
    .executeTakeFirstOrThrow();
  for (const [i, brand] of ["MSI", "ASUS", "Zotac", "MSI"].entries()) {
    const product = await db.query
      .insertInto("products")
      .values({
        slug: `p${i}`,
        name: `GPU ${i}`,
        category: "gpu",
        brand,
        offer_count: 1,
        created_at: NOW,
        updated_at: NOW,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db.query
      .insertInto("listings")
      .values({
        store_id: store.id,
        product_id: product.id,
        external_id: `e${i}`,
        url: `https://beta.cl/p/${i}`,
        title: `GPU ${i}`,
        category: "gpu",
        brand,
        price_cash: 100_000 + i,
        price_card: 100_000 + i,
        in_stock: 1,
        first_seen_at: NOW,
        last_seen_at: NOW,
        updated_at: NOW,
      })
      .execute();
  }
}

describe("filtro por varias marcas", () => {
  test("el contrato acepta una marca, varias o ninguna", () => {
    expect(query({}).brand).toBeUndefined();
    expect(query({ brand: "msi" }).brand).toEqual(["msi"]);
    expect(query({ brand: ["msi", "asus"] }).brand).toEqual(["msi", "asus"]);
  });

  test("varias marcas son un 'o', y el slug sirve igual que el nombre", async () => {
    await seed();
    const page = await listProducts(db, query({ brand: ["msi", "ASUS"] }), undefined);
    expect(page.total).toBe(3);
    expect(page.items.map((p) => p.brand).sort()).toEqual(["ASUS", "MSI", "MSI"]);
  });

  test("las marcas se cuentan con los demás filtros pero sin el de marca", async () => {
    await seed();
    const brands = await listBrands(db, "gpu", query({ brand: ["asus"] }));
    expect(brands.map((b) => [b.slug, b.count])).toEqual([
      ["msi", 2],
      ["asus", 1],
      ["zotac", 1],
    ]);
  });
});
