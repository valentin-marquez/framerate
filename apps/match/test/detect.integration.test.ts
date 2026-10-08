import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { proposeDuplicateReviews } from "@/detect";

/** El detector de duplicados ya creados (#148): propone revisiones, nunca fusiona por su cuenta. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
const now = new Date("2026-10-08T12:00:00.000Z");
const at = "2026-10-07T12:00:00.000Z";

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const KEY = "gpu|msi|gt 1030|4|lp|true";

async function seed() {
  const store = await db.query
    .insertInto("stores")
    .values({ slug: "alfa", name: "alfa", url: "https://alfa.cl", domain: "alfa.cl", created_at: at })
    .returning("id")
    .executeTakeFirstOrThrow();
  const product = async (slug: string, name: string, offers: number, key: string | null = KEY) =>
    (
      await db.query
        .insertInto("products")
        .values({
          slug,
          name,
          category: "gpu",
          brand: "MSI",
          attribute_key: key,
          offer_count: offers,
          created_at: at,
          updated_at: at,
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  const listing = async (externalId: string, productId: number, title: string, active: 0 | 1 = 1) =>
    (
      await db.query
        .insertInto("listings")
        .values({
          store_id: store.id,
          product_id: productId,
          external_id: externalId,
          url: `https://alfa.cl/p/${externalId}`,
          title,
          category: "gpu",
          brand: "MSI",
          price_cash: 90_000,
          price_card: 90_000,
          in_stock: 1,
          is_active: active,
          first_seen_at: at,
          last_seen_at: at,
          updated_at: at,
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  return { product, listing };
}

test("abre una revisión por oferta del producto chico contra el que tiene más ofertas", async () => {
  const { product, listing } = await seed();
  const grande = await product("msi-gt-1030-4gb-lp-oc", "MSI GeForce GT 1030 4GD4 LP OC 4GB GDDR4", 2);
  const chico = await product("msi-gt-1030-4gb-ddr4-lp-oc", "MSI GT 1030 4GB DDR4 LP OC", 1);
  await listing("a", grande, "MSI GeForce GT 1030 4GD4 LP OC 4GB GDDR4");
  await listing("b", grande, "MSI GT 1030 4GD4 LP OC");
  const suya = await listing("c", chico, "MSI GT 1030 4GB DDR4 LP OC");

  const result = await proposeDuplicateReviews(db, { now });
  expect(result.proposed).toBe(1);
  const reviews = (await all(db, "match_reviews")) as Array<{
    listing_id: number;
    candidate_product_id: number;
    status: string;
    evidence: string;
  }>;
  expect(reviews).toHaveLength(1);
  expect(reviews[0]).toMatchObject({ listing_id: suya, candidate_product_id: grande, status: "pending" });
  expect(JSON.parse(reviews[0]?.evidence ?? "{}")).toMatchObject({
    detector: "attribute_key",
    previousProductId: chico,
  });
  // No fusiona nada por su cuenta.
  expect(await all(db, "products")).toHaveLength(2);
  expect((await all(db, "listings")).find((l) => (l as { id: number }).id === suya)).toMatchObject({
    product_id: chico,
  });
});

test("no propone dos veces, ni con veto, ni si el par ya se rechazó", async () => {
  const { product, listing } = await seed();
  const grande = await product("msi-gt-1030-4gb-lp-oc", "MSI GeForce GT 1030 4GD4 LP OC 4GB GDDR4", 2);
  const chico = await product("msi-gt-1030-4gb-ddr4-lp-oc", "MSI GT 1030 4GB DDR4 LP OC", 1);
  // Otra tarjeta con la misma clave pero una variante distinta: `compare` la veta.
  const otra = await product("msi-gt-1030-4gb-lp-oc-v2", "MSI GT 1030 4GB DDR4 LP OC V2", 1);
  await listing("a", grande, "MSI GeForce GT 1030 4GD4 LP OC 4GB GDDR4");
  await listing("b", grande, "MSI GT 1030 4GD4 LP OC");
  await listing("c", chico, "MSI GT 1030 4GB DDR4 LP OC");
  await listing("d", otra, "MSI GT 1030 4GB DDR4 LP OC V2");

  expect((await proposeDuplicateReviews(db, { now })).proposed).toBe(1);
  const segunda = await proposeDuplicateReviews(db, { now });
  expect(segunda.proposed).toBe(0);
  expect(segunda.skipped).toMatchObject({ ya_pendiente: 1, "veto:attribute:variant": 1 });
  expect(await all(db, "match_reviews")).toHaveLength(1);
});

test("en seco cuenta lo que haría sin escribir nada", async () => {
  const { product, listing } = await seed();
  const grande = await product("msi-gt-1030-4gb-lp-oc", "MSI GeForce GT 1030 4GD4 LP OC 4GB GDDR4", 2);
  const chico = await product("msi-gt-1030-4gb-ddr4-lp-oc", "MSI GT 1030 4GB DDR4 LP OC", 1);
  await listing("a", grande, "MSI GeForce GT 1030 4GD4 LP OC 4GB GDDR4");
  await listing("c", chico, "MSI GT 1030 4GB DDR4 LP OC");

  const result = await proposeDuplicateReviews(db, { now, dryRun: true });
  expect(result.proposed).toBe(1);
  expect(result.samples[0]).toMatchObject({ candidateProductId: grande });
  expect(await all(db, "match_reviews")).toHaveLength(0);
});

test("un producto sin clave no se propone: no hay con qué agruparlo", async () => {
  const { product, listing } = await seed();
  const uno = await product("msi-gt-1030-a", "MSI GeForce GT 1030 4GB GDDR4", 1, null);
  const otro = await product("msi-gt-1030-b", "MSI GT 1030 4GB DDR4", 1, null);
  await listing("a", uno, "MSI GeForce GT 1030 4GB GDDR4");
  await listing("b", otro, "MSI GT 1030 4GB DDR4");
  expect((await proposeDuplicateReviews(db, { now })).proposed).toBe(0);
});
