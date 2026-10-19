import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { buildFingerprint } from "./domain/fingerprint";
import { matchListing } from "./match-listing";
import { resolveMatchReview } from "./resolve-review";
import { revertAiDecisions, splitListing } from "./split";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const NOW = "2026-10-01T00:00:00.000Z";
const TITLE = "Corsair Vengeance RGB 32GB DDR5";
const MPN = "CMH32GX5M2B6000C30";

let storeId: number;
async function seedStore() {
  const row = await db.query
    .insertInto("stores")
    .values({ slug: "beta", name: "beta", url: "https://beta.cl", domain: "beta.cl", created_at: NOW })
    .returning("id")
    .executeTakeFirstOrThrow();
  storeId = row.id;
}

async function product(slug: string, name: string, brand: string, mpn?: string) {
  const row = await db.query
    .insertInto("products")
    .values({ slug, name, category: "ram", brand, created_at: NOW, updated_at: NOW })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (mpn)
    await db.query.insertInto("product_identifiers").values({ kind: "mpn", value: mpn, product_id: row.id }).execute();
  return row.id;
}

async function listing(externalId: string, productId: number | null, title = TITLE, mpn: string | null = MPN) {
  const row = await db.query
    .insertInto("listings")
    .values({
      store_id: storeId,
      product_id: productId,
      external_id: externalId,
      url: `https://beta.cl/p/${externalId}`,
      title,
      category: "ram",
      brand: "Corsair",
      mpn,
      price_cash: 100_000,
      price_card: 100_000,
      in_stock: 1,
      first_seen_at: NOW,
      last_seen_at: NOW,
      updated_at: NOW,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

const offerOf = (title = TITLE, mpn: string | null = MPN) => ({
  title,
  imageUrl: null,
  fingerprint: buildFingerprint({ category: "ram", title, brand: "Corsair", mpn }),
});

const decide = (
  listingId: number,
  productId: number | null,
  method: "identifier" | "manual" | "new_product",
  by = "system",
) =>
  db.query
    .insertInto("match_decisions")
    .values({
      listing_id: listingId,
      product_id: productId,
      method,
      confidence: 1,
      evidence: "{}",
      decided_by: by,
      created_at: NOW,
    })
    .execute();

const productOf = async (listingId: number) => (await all(db, "listings")).find((l) => l.id === listingId)?.product_id;

describe("overrides", () => {
  test("forbid: un par rechazado no se vuelve a proponer ni a vincular", async () => {
    await seedStore();
    const candidate = await product("corsair-vengeance", TITLE, "Corsair", MPN);
    const own = await product("provisional", "Corsair Vengeance RGB 32GB", "Corsair");
    const id = await listing("1", own, TITLE, null);
    const review = await db.query
      .insertInto("match_reviews")
      .values({ listing_id: id, candidate_product_id: candidate, score: 0.7, created_at: NOW })
      .returning("id")
      .executeTakeFirstOrThrow();
    await resolveMatchReview(db, { reviewId: review.id, action: "reject", decidedBy: "valentin", now: NOW });
    expect(await all(db, "match_overrides")).toMatchObject([{ listing_id: id, product_id: candidate, kind: "forbid" }]);

    await db.query.updateTable("listings").set({ mpn: MPN }).where("id", "=", id).execute();
    const result = await matchListing(db, { listingId: id, currentProductId: own, offer: offerOf(), now: NOW });
    expect(result.outcome).not.toBe("linked");
    expect(await productOf(id)).not.toBe(candidate);
    expect((await all(db, "match_reviews")).filter((r) => r.status === "pending")).toEqual([]);
  });

  test("force: el vínculo sobrevive a un veto, sin él la oferta sale", async () => {
    await seedStore();
    const kingston = await product("kingston", "Kingston Fury Beast 32GB DDR5", "Kingston");
    const id = await listing("1", kingston, TITLE, null);
    await decide(id, kingston, "identifier");

    await db.query
      .insertInto("match_overrides")
      .values({ listing_id: id, product_id: kingston, kind: "force", created_by: "valentin", created_at: NOW })
      .execute();
    const kept = await matchListing(db, {
      listingId: id,
      currentProductId: kingston,
      offer: offerOf(TITLE, null),
      now: NOW,
    });
    expect(kept.outcome).toBe("kept");
    expect(await productOf(id)).toBe(kingston);

    await db.query.deleteFrom("match_overrides").execute();
    const moved = await matchListing(db, {
      listingId: id,
      currentProductId: kingston,
      offer: offerOf(TITLE, null),
      now: NOW,
    });
    expect(moved.unlinked).toBe(true);
    expect(await productOf(id)).not.toBe(kingston);
  });

  test("force vincula a un producto que la búsqueda no encontraría", async () => {
    await seedStore();
    const kingston = await product("kingston", "Kingston Fury Beast 32GB DDR5", "Kingston");
    const id = await listing("1", null, TITLE, null);
    await db.query
      .insertInto("match_overrides")
      .values({ listing_id: id, product_id: kingston, kind: "force", created_by: "valentin", created_at: NOW })
      .execute();
    const result = await matchListing(db, {
      listingId: id,
      currentProductId: null,
      offer: offerOf(TITLE, null),
      now: NOW,
    });
    expect(result.outcome).toBe("linked");
    expect(await productOf(id)).toBe(kingston);
  });
});

describe("identificador de otro producto", () => {
  const GTIN = "00840006600008";

  test("la fundadora de un duplicado se muda al dueño de su MPN y no vuelve", async () => {
    await seedStore();
    const owner = await product("owner", TITLE, "Corsair", MPN);
    await decide(await listing("0", owner), owner, "new_product");
    const duplicate = await product("duplicate", TITLE, "Corsair");
    const id = await listing("1", duplicate);
    await decide(id, duplicate, "new_product");

    const moved = await matchListing(db, { listingId: id, currentProductId: duplicate, offer: offerOf(), now: NOW });
    expect(moved).toMatchObject({ outcome: "linked", unlinked: true });
    expect(await productOf(id)).toBe(owner);

    const again = await matchListing(db, { listingId: id, currentProductId: owner, offer: offerOf(), now: NOW });
    expect(again.outcome).toBe("kept");
  });

  test("se queda si su producto también la reconoce por identificador, o si el par está prohibido", async () => {
    await seedStore();
    await product("owner", TITLE, "Corsair", MPN);
    const current = await product("current", TITLE, "Corsair");
    await db.query
      .insertInto("product_identifiers")
      .values({ kind: "gtin", value: GTIN, product_id: current })
      .execute();
    const other = await listing("2", current, TITLE, null);
    await db.query.updateTable("listings").set({ gtin: GTIN }).where("id", "=", other).execute();
    const id = await listing("1", current);
    await db.query.updateTable("listings").set({ gtin: GTIN }).where("id", "=", id).execute();
    await decide(id, current, "identifier");
    const offer = {
      ...offerOf(),
      fingerprint: buildFingerprint({ category: "ram", title: TITLE, brand: "Corsair", mpn: MPN, gtin: GTIN }),
    };
    expect((await matchListing(db, { listingId: id, currentProductId: current, offer, now: NOW })).outcome).toBe(
      "kept",
    );

    const alone = await product("alone", TITLE, "Corsair");
    const founder = await listing("3", alone);
    await decide(founder, alone, "new_product");
    const owner = (await all(db, "product_identifiers")).find((i) => i.kind === "mpn")?.product_id as number;
    await db.query
      .insertInto("match_overrides")
      .values({ listing_id: founder, product_id: owner, kind: "forbid", created_by: "valentin", created_at: NOW })
      .execute();
    const forbidden = await matchListing(db, {
      listingId: founder,
      currentProductId: alone,
      offer: offerOf(),
      now: NOW,
    });
    expect(forbidden.outcome).toBe("kept");
    expect(await productOf(founder)).toBe(alone);
  });

  test("el vínculo que se queda le pasa al producto el MPN que la oferta empezó a publicar", async () => {
    await seedStore();
    const current = await product("current", TITLE, "Corsair");
    await db.query
      .insertInto("product_identifiers")
      .values({ kind: "gtin", value: GTIN, product_id: current })
      .execute();
    const other = await listing("2", current, TITLE, null);
    await db.query.updateTable("listings").set({ gtin: GTIN }).where("id", "=", other).execute();
    const id = await listing("1", current);
    await db.query.updateTable("listings").set({ gtin: GTIN }).where("id", "=", id).execute();
    await decide(id, current, "identifier");
    const offer = {
      ...offerOf(),
      fingerprint: buildFingerprint({ category: "ram", title: TITLE, brand: "Corsair", mpn: MPN, gtin: GTIN }),
    };
    expect((await matchListing(db, { listingId: id, currentProductId: current, offer, now: NOW })).outcome).toBe(
      "kept",
    );
    expect(await all(db, "product_identifiers")).toContainEqual({ kind: "mpn", value: MPN, product_id: current });
  });

  describe("MPN que la tienda cambió (#99)", () => {
    const OLD = "CMH32GX5M2B5600C36";
    const identifiersOf = async (productId: number) =>
      (await all(db, "product_identifiers")).filter((i) => i.product_id === productId).map((i) => i.value);
    const rematch = (id: number, productId: number) =>
      matchListing(db, {
        listingId: id,
        currentProductId: productId,
        offer: offerOf(),
        canonicalName: TITLE,
        now: NOW,
      });

    test("el vínculo se queda y el MPN viejo, que ninguna oferta publica, sale del producto", async () => {
      await seedStore();
      const current = await product("current", TITLE, "Corsair", OLD);
      const id = await listing("1", current);
      await decide(id, current, "identifier");
      expect((await rematch(id, current)).outcome).toBe("kept");
      expect(await identifiersOf(current)).toEqual([MPN]);
    });

    test("si otra oferta del producto sigue publicando el MPN viejo, se queda", async () => {
      await seedStore();
      const current = await product("current", TITLE, "Corsair", OLD);
      await listing("2", current, TITLE, OLD);
      const id = await listing("1", current);
      await decide(id, current, "identifier");
      await rematch(id, current);
      expect((await identifiersOf(current)).sort()).toEqual([MPN, OLD].sort());
    });

    test("un MPN que sólo viene de lo que Haiku leyó de la oferta cuenta como publicado", async () => {
      await seedStore();
      const current = await product("current", TITLE, "Corsair", OLD);
      const id = await listing("1", current, TITLE, null);
      await db.query
        .insertInto("listing_identity")
        .values({
          listing_id: id,
          version: 1,
          input_hash: "h",
          model: "m",
          category: "ram",
          brand: "Corsair",
          name: TITLE,
          mpn: OLD,
          confidence: "high",
          identity: "{}",
          identity_raw: "{}",
          specs: "{}",
          specs_source: "{}",
          same_as: null,
          created_at: NOW,
        })
        .execute();
      await decide(id, current, "identifier");
      await matchListing(db, {
        listingId: id,
        currentProductId: current,
        offer: offerOf(TITLE, OLD),
        canonicalName: TITLE,
        now: NOW,
      });
      expect(await identifiersOf(current)).toEqual([OLD]);
    });
  });
});

/** Oferta que la IA movió de `provisional` a `target` (como `resolveMatchReview`). */
async function aiMerge(externalId: string, target: number, model = "m1", at = NOW) {
  const provisional = await product(`prov-${externalId}`, "Corsair Vengeance RGB 32GB", "Corsair");
  const id = await listing(externalId, target, TITLE, `MPNCODE${externalId}`);
  await db.query
    .insertInto("match_decisions")
    .values({
      listing_id: id,
      product_id: target,
      method: "manual",
      confidence: 1,
      evidence: JSON.stringify({ previousProductId: provisional }),
      decided_by: `ai:${model}`,
      created_at: at,
    })
    .execute();
  await db.query
    .insertInto("product_identifiers")
    .values({ kind: "mpn", value: `MPNCODE${externalId}`, product_id: target })
    .execute();
  return { id, provisional };
}

describe("separar fusiones", () => {
  test("devuelve la oferta y sus identificadores al producto anterior y deja forbid", async () => {
    await seedStore();
    const target = await product("target", TITLE, "Corsair");
    const { id, provisional } = await aiMerge("1", target);

    const result = await splitListing(db, { listingId: id, decidedBy: "valentin", now: NOW });
    expect(result).toEqual({ status: "split", productId: provisional, created: false });
    expect(await productOf(id)).toBe(provisional);
    expect(await all(db, "product_identifiers")).toEqual([{ kind: "mpn", value: "MPNCODE1", product_id: provisional }]);
    expect(await all(db, "match_overrides")).toMatchObject([{ listing_id: id, product_id: target, kind: "forbid" }]);
    expect((await all(db, "match_decisions")).at(-1)).toMatchObject({
      decided_by: "valentin",
      product_id: provisional,
    });
  });

  test("si el producto anterior ya no existe, crea uno nuevo", async () => {
    await seedStore();
    const target = await product("target", TITLE, "Corsair");
    const { id, provisional } = await aiMerge("1", target);
    await db.query.deleteFrom("products").where("id", "=", provisional).execute();

    const result = await splitListing(db, { listingId: id, decidedBy: "valentin", now: NOW });
    expect(result).toMatchObject({ status: "split", created: true });
    expect(await productOf(id)).not.toBe(target);
    expect(await productOf(id)).not.toBeNull();
    const created = await db.query
      .selectFrom("products")
      .select("published_at")
      .where("id", "=", (await productOf(id)) as number)
      .executeTakeFirstOrThrow();
    expect(created.published_at).toBe(NOW);
  });

  test("revert en bloque: sólo decisiones ai: vigentes del modelo y rango pedidos", async () => {
    await seedStore();
    const target = await product("target", TITLE, "Corsair");
    const a = await aiMerge("1", target, "m1", "2026-10-01T00:00:00.000Z");
    const b = await aiMerge("2", target, "m1", "2026-10-03T00:00:00.000Z");
    const c = await aiMerge("3", target, "m2", "2026-10-01T00:00:00.000Z");
    const human = await aiMerge("4", target, "m1");
    await db.query
      .updateTable("match_decisions")
      .set({ decided_by: "valentin" })
      .where("listing_id", "=", human.id)
      .execute();

    const result = await revertAiDecisions(db, {
      model: "m1",
      until: "2026-10-02T00:00:00.000Z",
      decidedBy: "valentin",
      now: NOW,
    });
    expect(result).toEqual({ reverted: 1, remaining: 0 });
    expect(await productOf(a.id)).toBe(a.provisional);
    expect(await productOf(b.id)).toBe(target);
    expect(await productOf(c.id)).toBe(target);
    expect(await productOf(human.id)).toBe(target);

    const rest = await revertAiDecisions(db, { decidedBy: "valentin", now: NOW, limit: 1 });
    expect(rest).toEqual({ reverted: 1, remaining: 1 });
    expect(await revertAiDecisions(db, { decidedBy: "valentin", now: NOW })).toEqual({ reverted: 1, remaining: 0 });
  });
});

describe("resumen de precios al mover una oferta", () => {
  const summary = async (id: number) => {
    const row = (await all(db, "products")).find((p) => p.id === id);
    return {
      best_price: row?.best_price,
      offer_count: row?.offer_count,
      in_stock_offer_count: row?.in_stock_offer_count,
    };
  };

  test("aceptar y separar recalculan el producto que gana la oferta y el que la pierde", async () => {
    await seedStore();
    const candidate = await product("corsair-vengeance", TITLE, "Corsair", MPN);
    const own = await product("provisional", "Corsair Vengeance RGB 32GB", "Corsair");
    const id = await listing("1", own);
    await db.query
      .updateTable("products")
      .set({ best_price: 100_000, offer_count: 1, in_stock_offer_count: 1 })
      .where("id", "=", own)
      .execute();
    const review = await db.query
      .insertInto("match_reviews")
      .values({ listing_id: id, candidate_product_id: candidate, score: 0.7, created_at: NOW })
      .returning("id")
      .executeTakeFirstOrThrow();

    await resolveMatchReview(db, { reviewId: review.id, action: "accept", decidedBy: "valentin", now: NOW });
    expect(await summary(candidate)).toEqual({ best_price: 100_000, offer_count: 1, in_stock_offer_count: 1 });
    expect(await summary(own)).toEqual({ best_price: null, offer_count: 0, in_stock_offer_count: 0 });

    await splitListing(db, { listingId: id, decidedBy: "valentin", now: NOW });
    expect(await summary(own)).toEqual({ best_price: 100_000, offer_count: 1, in_stock_offer_count: 1 });
    expect(await summary(candidate)).toEqual({ best_price: null, offer_count: 0, in_stock_offer_count: 0 });
  });
});
