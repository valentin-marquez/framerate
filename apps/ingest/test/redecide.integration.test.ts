import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { crawlCategory } from "@/features/ingestion/crawl-category";
import { fakeStore, offer, steppingClock, testDeps } from "./helpers";

let d1: D1Database;
let dispose: () => Promise<void>;
beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const BLACK = {
  category: "gpu" as const,
  title: "Tarjeta de Video MSI GeForce RTX 5060 8G VENTUS 2X OC",
  priceCash: 383_490,
};
const WHITE = {
  category: "gpu" as const,
  title: "MSI GeForce RTX 5060 Ventus 2X White OC 8GB GDDR7",
  priceCash: 449_990,
  mpn: "912V537018",
};

async function listingOf(db: Db, externalId: string) {
  const listing = (await all(db, "listings")).find((l) => l.external_id === externalId);
  if (!listing) throw new Error(`sin oferta ${externalId}`);
  return listing;
}

async function productOf(db: Db, externalId: string): Promise<number> {
  const { product_id } = await listingOf(db, externalId);
  if (product_id === null) throw new Error(`oferta ${externalId} sin producto`);
  return product_id;
}

/** Reproduce una fusión hecha con el extractor viejo: la oferta pasa al producto ajeno y le deja sus identificadores. */
async function forceLink(db: Db, externalId: string, productId: number) {
  const listing = await listingOf(db, externalId);
  await db.query
    .updateTable("product_identifiers")
    .set({ product_id: productId })
    .where("product_id", "=", listing.product_id)
    .execute();
  await db.query.updateTable("listings").set({ product_id: productId }).where("id", "=", listing.id).execute();
  await db.query
    .insertInto("match_decisions")
    .values({
      listing_id: listing.id,
      product_id: productId,
      method: "identifier",
      confidence: 0.99,
      evidence: "{}",
      decided_by: "system",
      created_at: new Date().toISOString(),
    })
    .execute();
}

describe("re-decisión de vínculos existentes", () => {
  test("las White fusionadas con la negra se separan, sin llevarse a la negra ni dejarle sus códigos", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const dust2 = fakeStore("dust2", { gpu: ["gpu"] });
    const myshop = fakeStore("myshop", { gpu: ["gpu"] });
    const pcfactory = fakeStore("pcfactory", { gpu: ["gpu"] });
    dust2.setOffers([offer("dust2", "b", BLACK)]);
    myshop.setOffers([offer("myshop", "w1", WHITE)]);
    pcfactory.setOffers([offer("pcfactory", "w2", WHITE)]);
    for (const s of [dust2, myshop, pcfactory]) await crawlCategory(deps, s.store, "gpu");

    const black = await productOf(deps.db, "b");
    await forceLink(deps.db, "w1", black);
    await forceLink(deps.db, "w2", black);

    clock.advance(6 * 3600_000);
    for (const s of [dust2, myshop, pcfactory]) await crawlCategory(deps, s.store, "gpu");

    const w1 = (await listingOf(deps.db, "w1")).product_id;
    expect((await listingOf(deps.db, "b")).product_id).toBe(black);
    expect(w1).not.toBe(black);
    expect((await listingOf(deps.db, "w2")).product_id).toBe(w1);
    const blackIds = (await all(deps.db, "product_identifiers")).filter((i) => i.product_id === black);
    expect(blackIds.map((i) => i.value)).not.toContain("912V537018");
  });

  test("segunda pasada sin cambios", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const dust2 = fakeStore("dust2", { gpu: ["gpu"] });
    const myshop = fakeStore("myshop", { gpu: ["gpu"] });
    dust2.setOffers([offer("dust2", "b", BLACK)]);
    myshop.setOffers([offer("myshop", "w1", WHITE)]);
    for (const s of [dust2, myshop]) await crawlCategory(deps, s.store, "gpu");
    await forceLink(deps.db, "w1", await productOf(deps.db, "b"));

    clock.advance(6 * 3600_000);
    for (const s of [dust2, myshop]) await crawlCategory(deps, s.store, "gpu");
    const decisions = (await all(deps.db, "match_decisions")).length;
    clock.advance(6 * 3600_000);
    for (const s of [dust2, myshop]) await crawlCategory(deps, s.store, "gpu");
    expect((await all(deps.db, "match_decisions")).length).toBe(decisions);
  });

  test("una decisión manual no se toca aunque el extractor la vete", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const dust2 = fakeStore("dust2", { gpu: ["gpu"] });
    const myshop = fakeStore("myshop", { gpu: ["gpu"] });
    dust2.setOffers([offer("dust2", "b", BLACK)]);
    myshop.setOffers([offer("myshop", "w1", WHITE)]);
    for (const s of [dust2, myshop]) await crawlCategory(deps, s.store, "gpu");
    const blackProduct = await productOf(deps.db, "b");
    await forceLink(deps.db, "w1", blackProduct);
    const w1 = await listingOf(deps.db, "w1");
    await deps.db.query
      .insertInto("match_decisions")
      .values({
        listing_id: w1.id,
        product_id: blackProduct,
        method: "manual",
        confidence: 1,
        evidence: "{}",
        decided_by: "admin",
        created_at: new Date().toISOString(),
      })
      .execute();

    clock.advance(6 * 3600_000);
    await crawlCategory(deps, myshop.store, "gpu");
    expect((await listingOf(deps.db, "w1")).product_id).toBe(blackProduct);
  });

  test("una oferta publicada en otra categoría que la de su producto no se desvincula", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const infor = fakeStore("infor", { psu: ["psu"], case: ["case"] });
    const psu = { title: "FUENTE DE PODER GAMEMAX GP-650 650W 80 PLUS BRONZE", priceCash: 45_000 };
    infor.setOffers([offer("infor", "f1", { ...psu, category: "psu" })]);
    await crawlCategory(deps, infor.store, "psu");
    const product = await productOf(deps.db, "f1");
    // Mismo externalId bajo gabinetes, con un título que no la delata como fuente.
    infor.setOffers([offer("infor", "f1", { title: "GAMEMAX GP-650 Negro", priceCash: 45_000, category: "case" })]);
    await crawlCategory(deps, infor.store, "case");
    expect((await listingOf(deps.db, "f1")).product_id).toBe(product);
    expect(await all(deps.db, "products")).toHaveLength(1);
  });
});
