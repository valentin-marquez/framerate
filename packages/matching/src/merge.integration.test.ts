import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { buildFingerprint } from "./domain/fingerprint";
import { mergeProductPair, mergeSplitIdentity } from "./merge";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const NOW = "2026-10-07T15:00:00.000Z";
const TITLE = "Kingston KC600 1TB SATA SSD";
const MPN = "SKC6001024G";
const GTIN = "00740617301298";

let storeId: number;
async function seed() {
  storeId = (
    await db.query
      .insertInto("stores")
      .values({ slug: "beta", name: "beta", url: "https://beta.cl", domain: "beta.cl", created_at: NOW })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}

async function product(slug: string, name: string, offers: number, id: { kind: "mpn" | "gtin"; value: string }) {
  const row = await db.query
    .insertInto("products")
    .values({ slug, name, category: "ssd", brand: "Kingston", offer_count: offers, created_at: NOW, updated_at: NOW })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db.query
    .insertInto("product_identifiers")
    .values({ ...id, product_id: row.id })
    .execute();
  return row.id;
}

async function listing(externalId: string, productId: number, price: number, ids: { mpn?: string; gtin?: string }) {
  return (
    await db.query
      .insertInto("listings")
      .values({
        store_id: storeId,
        product_id: productId,
        external_id: externalId,
        url: `https://beta.cl/p/${externalId}`,
        title: TITLE,
        category: "ssd",
        brand: "Kingston",
        mpn: ids.mpn ?? null,
        gtin: ids.gtin ?? null,
        price_cash: price,
        price_card: price,
        in_stock: 1,
        first_seen_at: NOW,
        last_seen_at: NOW,
        updated_at: NOW,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}

const fingerprint = (title = TITLE) =>
  buildFingerprint({ category: "ssd", title, brand: "Kingston", mpn: MPN, gtin: GTIN });

describe("fusión por identidad repartida", () => {
  test("el producto con menos ofertas pasa entero al otro y su slug redirige", async () => {
    await seed();
    const big = await product("kingston-kc600-1tb", TITLE, 2, { kind: "mpn", value: MPN });
    const small = await product("kingston-kc600-1tb-2", TITLE, 1, { kind: "gtin", value: GTIN });
    await listing("a", big, 50_000, { mpn: MPN });
    await listing("b", big, 48_000, { mpn: MPN });
    const proof = await listing("c", small, 45_000, { mpn: MPN, gtin: GTIN });
    await db.query
      .insertInto("product_price_daily")
      .values([
        { product_id: big, day: "2026-10-06", min_cash: 50_000, min_card: 50_000, offer_count: 2 },
        { product_id: small, day: "2026-10-06", min_cash: 45_000, min_card: 45_000, offer_count: 1 },
      ])
      .execute();
    await db.query
      .insertInto("users")
      .values({ id: "u1", email: "u@x.cl", username: "u_1", display_name: "U", created_at: NOW, updated_at: NOW })
      .execute();
    const quote = (
      await db.query
        .insertInto("quotes")
        .values({ public_id: "abcdefgh", owner_id: "u1", name: "PC", created_at: NOW, updated_at: NOW })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
    await db.query
      .insertInto("quote_items")
      .values({ quote_id: quote, product_id: small, slot: "storage", created_at: NOW, updated_at: NOW })
      .execute();

    const result = await mergeSplitIdentity(db, { listingId: proof, fingerprint: fingerprint(), now: NOW });
    expect(result).toEqual({ status: "merged", from: small, to: big });

    const products = await all(db, "products");
    expect(products.map((p) => p.id)).toEqual([big]);
    expect(products[0]).toMatchObject({ offer_count: 3, best_price: 45_000 });
    expect((await all(db, "listings")).every((l) => l.product_id === big)).toBe(true);
    expect((await all(db, "product_identifiers")).map((i) => i.product_id)).toEqual([big, big]);
    expect(await all(db, "product_slug_redirects")).toMatchObject([
      { old_slug: "kingston-kc600-1tb-2", product_id: big },
    ]);
    expect(await all(db, "quote_items")).toMatchObject([{ product_id: big }]);
    expect((await all(db, "product_price_daily")).find((d) => d.day === "2026-10-06")).toMatchObject({
      product_id: big,
      min_cash: 45_000,
      offer_count: 3,
    });
    expect((await all(db, "match_decisions")).at(-1)).toMatchObject({ listing_id: proof, product_id: big });
  });

  test("no fusiona si el par ya fue rechazado o si un atributo los separa", async () => {
    await seed();
    const big = await product("kc600-1tb", TITLE, 2, { kind: "mpn", value: MPN });
    const small = await product("kc600-512", "Kingston KC600 512GB SATA SSD", 1, { kind: "gtin", value: GTIN });
    const proof = await listing("c", small, 45_000, { mpn: MPN, gtin: GTIN });

    const vetoed = await mergeSplitIdentity(db, { listingId: proof, fingerprint: fingerprint(), now: NOW });
    expect(vetoed).toMatchObject({ status: "skipped", reason: expect.stringContaining("veto:") });

    await db.query.updateTable("products").set({ name: TITLE }).where("id", "=", small).execute();
    await db.query
      .insertInto("match_reviews")
      .values({ listing_id: proof, candidate_product_id: big, score: 0.7, status: "rejected", created_at: NOW })
      .execute();
    const rejected = await mergeSplitIdentity(db, { listingId: proof, fingerprint: fingerprint(), now: NOW });
    expect(rejected).toEqual({ status: "skipped", from: small, to: big, reason: "rejected" });
    expect(await all(db, "products")).toHaveLength(2);
  });

  test("sin los dos identificadores, o con los dos en el mismo producto, no hace nada", async () => {
    await seed();
    const own = await product("kc600", TITLE, 1, { kind: "mpn", value: MPN });
    await db.query.insertInto("product_identifiers").values({ kind: "gtin", value: GTIN, product_id: own }).execute();
    const id = await listing("a", own, 45_000, { mpn: MPN, gtin: GTIN });
    expect(await mergeSplitIdentity(db, { listingId: id, fingerprint: fingerprint(), now: NOW })).toBeNull();
    const onlyMpn = buildFingerprint({ category: "ssd", title: TITLE, brand: "Kingston", mpn: MPN });
    expect(await mergeSplitIdentity(db, { listingId: id, fingerprint: onlyMpn, now: NOW })).toBeNull();
  });
});

describe("fusión a mano de dos productos (#147)", () => {
  test("junta los dos sin una oferta que lo pruebe: el de menos ofertas entra en el de más", async () => {
    await seed();
    const big = await product("kingston-kc600-1tb", TITLE, 2, { kind: "mpn", value: MPN });
    const small = await product("kc600-1tb-otra", TITLE, 1, { kind: "gtin", value: GTIN });
    await listing("a", big, 50_000, { mpn: MPN });
    await listing("b", big, 48_000, { mpn: MPN });
    await listing("c", small, 45_000, { gtin: GTIN });

    // Al revés a propósito: la dirección la decide quién tiene más ofertas, no el orden de los argumentos.
    const result = await mergeProductPair(db, { a: small, b: big, decidedBy: "user:ana", now: NOW });
    expect(result).toEqual({ status: "merged", from: small, to: big });

    expect((await all(db, "products")).map((p) => p.id)).toEqual([big]);
    expect((await all(db, "listings")).every((l) => l.product_id === big)).toBe(true);
    expect((await all(db, "product_identifiers")).map((i) => i.product_id)).toEqual([big, big]);
    expect(await all(db, "product_slug_redirects")).toMatchObject([{ old_slug: "kc600-1tb-otra", product_id: big }]);
    // Queda auditado quién lo pidió y sin oferta que lo pruebe.
    const decision = (await all(db, "match_decisions")).at(-1) as { decided_by: string; evidence: string };
    expect(decision.decided_by).toBe("user:ana");
    expect(JSON.parse(decision.evidence)).toMatchObject({ mergedFrom: small, proofListingId: null });
  });

  test("respeta el veto entre los dos productos y el par ya rechazado", async () => {
    await seed();
    const big = await product("kc600-1tb", TITLE, 2, { kind: "mpn", value: MPN });
    const otra = await product("kc600-512", "Kingston KC600 512GB SATA SSD", 1, { kind: "gtin", value: GTIN });
    const suya = await listing("c", otra, 45_000, { gtin: GTIN });

    const vetoed = await mergeProductPair(db, { a: big, b: otra, decidedBy: "user:ana", now: NOW });
    expect(vetoed).toMatchObject({ status: "skipped", from: otra, to: big, reason: "veto:attribute:capacity" });

    await db.query.updateTable("products").set({ name: TITLE }).where("id", "=", otra).execute();
    await db.query
      .insertInto("match_reviews")
      .values({ listing_id: suya, candidate_product_id: big, score: 0.7, status: "rejected", created_at: NOW })
      .execute();
    expect(await mergeProductPair(db, { a: big, b: otra, decidedBy: "user:ana", now: NOW })).toEqual({
      status: "skipped",
      from: otra,
      to: big,
      reason: "rejected",
    });
    expect(await all(db, "products")).toHaveLength(2);
  });

  test("el mismo producto dos veces, o uno que no existe, no hace nada", async () => {
    await seed();
    const uno = await product("kc600", TITLE, 1, { kind: "mpn", value: MPN });
    expect(await mergeProductPair(db, { a: uno, b: uno, decidedBy: "user:ana", now: NOW })).toMatchObject({
      status: "skipped",
      reason: "same_product",
    });
    expect(await mergeProductPair(db, { a: uno, b: 9999, decidedBy: "user:ana", now: NOW })).toMatchObject({
      status: "skipped",
      reason: "product_missing",
    });
    expect(await all(db, "products")).toHaveLength(1);
  });
});
