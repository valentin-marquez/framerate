import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { PipelineMessage } from "@framerate/contracts";
import type { Db, NormStatus, SqlBool } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { silentLogger } from "@framerate/kit";
import { resolveMatchReview } from "@framerate/matching";
import { linkListing, publishOverdue } from "@/link";

/** Vínculo desde la identidad de Haiku (#153): sombra, en vivo, relink y el plazo de 24 h. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
const now = new Date("2026-10-08T12:00:00.000Z");
const at = now.toISOString();
const twoDaysAgo = "2026-10-06T12:00:00.000Z";
const MPN = "100100000065BOX";
const NAME = "AMD Ryzen 5 5600X";
const KEY = "cpu|amd|ryzen 5 5600x";

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

async function store(slug: string) {
  return (
    await db.query
      .insertInto("stores")
      .values({ slug, name: slug, url: `https://${slug}.cl`, domain: `${slug}.cl`, created_at: twoDaysAgo })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}

async function product(input: { slug: string; name: string; attributes?: Record<string, unknown>; mpn?: string }) {
  const row = await db.query
    .insertInto("products")
    .values({
      slug: input.slug,
      name: input.name,
      category: "cpu",
      brand: "AMD",
      attributes: input.attributes ? JSON.stringify(input.attributes) : "{}",
      attribute_key: input.attributes ? KEY.replace("ryzen 5 5600x", String(input.attributes.model)) : null,
      created_at: twoDaysAgo,
      updated_at: twoDaysAgo,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (input.mpn) {
    await db.query
      .insertInto("product_identifiers")
      .values({ kind: "mpn", value: input.mpn, product_id: row.id })
      .execute();
  }
  return row.id;
}

async function listing(input: {
  store: number;
  external: string;
  title?: string;
  product?: number | null;
  mpn?: string | null;
  visible?: SqlBool;
  normStatus?: NormStatus;
  firstSeen?: string;
}) {
  return (
    await db.query
      .insertInto("listings")
      .values({
        store_id: input.store,
        external_id: input.external,
        url: `https://x.cl/p/${input.external}`,
        title: input.title ?? "Procesador AMD Ryzen 5 5600X AM4",
        category: "cpu",
        brand: "AMD",
        mpn: input.mpn ?? null,
        product_id: input.product ?? null,
        price_cash: 150_000,
        price_card: 150_000,
        in_stock: 1,
        visible: input.visible ?? 1,
        norm_status: input.normStatus ?? "legacy",
        first_seen_at: input.firstSeen ?? at,
        last_seen_at: at,
        updated_at: at,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}

async function identity(listingId: number, input: { name?: string; model?: string; mpn?: string | null } = {}) {
  await db.query
    .insertInto("listing_identity")
    .values({
      listing_id: listingId,
      version: 1,
      input_hash: "h",
      model: "claude-haiku-5-5",
      category: "cpu",
      brand: "AMD",
      name: input.name ?? NAME,
      mpn: input.mpn === undefined ? MPN : input.mpn,
      confidence: "high",
      identity: JSON.stringify({ model: input.model ?? "ryzen 5 5600x" }),
      identity_raw: "{}",
      specs: "{}",
      specs_source: "{}",
      created_at: at,
    })
    .execute();
}

const message = (listingId: number, reason: PipelineMessage["reason"] = "new"): PipelineMessage => ({
  listingId,
  version: 1,
  reason,
});
const listingRow = (id: number) =>
  db.query.selectFrom("listings").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
const productRow = (id: number) =>
  db.query.selectFrom("products").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
const decisions = (listingId: number) =>
  db.query
    .selectFrom("match_decisions")
    .select(["product_id", "method", "decided_by"])
    .where("listing_id", "=", listingId)
    .orderBy("id")
    .execute();

describe("sombra", () => {
  test("escribe match_shadow con la decisión contra el vínculo actual y no toca nada", async () => {
    const s = await store("alfa");
    const p = await product({ slug: "amd-ryzen-5-5600x", name: NAME, mpn: MPN });
    const l = await listing({ store: s, external: "1", product: p, mpn: MPN });
    await identity(l);

    expect(await linkListing(db, message(l), "shadow", now, silentLogger)).toBe("shadow");
    const [shadow] = await all(db, "match_shadow");
    expect(shadow).toMatchObject({
      listing_id: l,
      version: 1,
      kind: "link",
      product_id: p,
      current_product_id: p,
      agrees: 1,
    });
    expect((await listingRow(l)).norm_status).toBe("legacy");
    expect(await decisions(l)).toEqual([]);
  });

  test("una oferta vinculada a otro producto no coincide, y `backfill` sólo escribe sombra aunque esté en vivo", async () => {
    const s = await store("alfa");
    const right = await product({ slug: "amd-ryzen-5-5600x", name: NAME, mpn: MPN });
    const wrong = await product({ slug: "amd-ryzen-7-5800x", name: "AMD Ryzen 7 5800X" });
    const l = await listing({ store: s, external: "1", product: wrong, mpn: MPN });
    await identity(l);

    await linkListing(db, message(l, "backfill"), "live", now, silentLogger);
    const [shadow] = await all(db, "match_shadow");
    expect(shadow).toMatchObject({ kind: "link", product_id: right, current_product_id: wrong, agrees: 0 });
    expect(JSON.parse(shadow?.vetoes ?? "[]")).toEqual(["attribute:model"]);
    expect((await listingRow(l)).product_id).toBe(wrong);
  });

  test("apagado no hace nada", async () => {
    const s = await store("alfa");
    const l = await listing({ store: s, external: "1", visible: 0, normStatus: "normalized" });
    await identity(l);
    expect(await linkListing(db, message(l), "off", now, silentLogger)).toBe("off");
    expect(await all(db, "match_shadow")).toEqual([]);
  });
});

describe("en vivo", () => {
  test("vincula a un producto existente por identificador, lo publica y completa su huella", async () => {
    const s = await store("alfa");
    const p = await product({ slug: "amd-ryzen-5-5600x", name: NAME, mpn: MPN });
    const l = await listing({ store: s, external: "1", visible: 0, normStatus: "normalized" });
    await identity(l);

    expect(await linkListing(db, message(l), "live", now, silentLogger)).toBe("linked");
    expect(await listingRow(l)).toMatchObject({ product_id: p, visible: 1, norm_status: "linked" });
    expect(await productRow(p)).toMatchObject({ published_at: at, attribute_key: KEY });
    expect(await decisions(l)).toEqual([{ product_id: p, method: "identifier", decided_by: "system" }]);
    const [version] = await all(db, "catalog_version");
    expect(version?.version).toBeGreaterThan(0);
  });

  test("crea el producto con el nombre canónico, su huella desde la identidad, y lo publica", async () => {
    const s = await store("alfa");
    const l = await listing({ store: s, external: "1", visible: 0, normStatus: "normalized" });
    await identity(l);

    expect(await linkListing(db, message(l), "live", now, silentLogger)).toBe("new_product");
    const [p] = await all(db, "products");
    expect(p).toMatchObject({
      name: NAME,
      slug: "amd-ryzen-5-5600x",
      search: "amd ryzen 5 5600x",
      attribute_key: KEY,
      attributes: JSON.stringify({ model: "ryzen 5 5600x" }),
      published_at: at,
    });
    expect(await listingRow(l)).toMatchObject({ product_id: p?.id, visible: 1, norm_status: "linked" });
  });

  test("con revisión pendiente la oferta queda oculta hasta que se resuelve", async () => {
    const s = await store("alfa");
    const p = await product({ slug: "amd-ryzen-5-5600x", name: NAME, attributes: { model: "ryzen 5 5600x" } });
    // Otra oferta de la misma tienda ya vinculada desde su identidad: la huella guardada de P es la verdad.
    await listing({ store: s, external: "0", product: p, normStatus: "linked" });
    const l = await listing({ store: s, external: "1", visible: 0, normStatus: "normalized" });
    await identity(l);

    expect(await linkListing(db, message(l), "live", now, silentLogger)).toBe("review");
    const row = await listingRow(l);
    expect(row).toMatchObject({ visible: 0, norm_status: "linked" });
    expect(row.product_id).not.toBe(p);
    expect((await productRow(row.product_id as number)).published_at).toBeNull();
    const [review] = await all(db, "match_reviews");
    expect(review).toMatchObject({ listing_id: l, candidate_product_id: p, status: "pending" });

    await resolveMatchReview(db, { reviewId: review?.id as number, action: "reject", decidedBy: "test", now: at });
    expect((await listingRow(l)).visible).toBe(1);
    expect((await productRow(row.product_id as number)).published_at).toBe(at);
  });

  test("relink: re-decide el vínculo actual con la identidad y firma relink:v1", async () => {
    const [alfa, beta] = [await store("alfa"), await store("beta")];
    const right = await product({ slug: "amd-ryzen-5-5600x", name: NAME, mpn: MPN });
    const wrong = await product({
      slug: "amd-ryzen-7-5800x",
      name: "AMD Ryzen 7 5800X",
      attributes: { model: "ryzen 7 5800x" },
    });
    await listing({ store: beta, external: "9", product: wrong, normStatus: "linked" });
    const l = await listing({ store: alfa, external: "1", product: wrong, mpn: MPN });
    await identity(l);

    expect(await linkListing(db, message(l, "relink"), "live", now, silentLogger)).toBe("linked");
    expect(await listingRow(l)).toMatchObject({ product_id: right, visible: 1, norm_status: "linked" });
    expect(await decisions(l)).toEqual([
      { product_id: null, method: "unlinked", decided_by: "relink:v1" },
      { product_id: right, method: "identifier", decided_by: "relink:v1" },
    ]);
  });

  test("una oferta inactiva o sin identidad se salta", async () => {
    const s = await store("alfa");
    const l = await listing({ store: s, external: "1", visible: 0, normStatus: "pending" });
    expect(await linkListing(db, message(l), "live", now, silentLogger)).toBe("skipped");
    expect(await linkListing(db, message(999), "live", now, silentLogger)).toBe("skipped");
    expect((await listingRow(l)).visible).toBe(0);
  });
});

describe("plazo de 24 h", () => {
  test("lo oculto sin vínculo se vincula por regex como fallback; lo oculto en revisión se publica; lo reciente espera", async () => {
    const s = await store("alfa");
    const p = await product({ slug: "amd-ryzen-5-5600x", name: NAME, mpn: MPN });
    const overdue = await listing({
      store: s,
      external: "1",
      visible: 0,
      normStatus: "pending",
      mpn: MPN,
      firstSeen: twoDaysAgo,
    });
    const own = await product({ slug: "amd-ryzen-5-5600x-2", name: NAME });
    const inReview = await listing({
      store: s,
      external: "2",
      visible: 0,
      normStatus: "linked",
      product: own,
      firstSeen: twoDaysAgo,
    });
    const recent = await listing({ store: s, external: "3", visible: 0, normStatus: "pending" });

    expect(await publishOverdue(db, now, silentLogger)).toEqual({ published: 2, fallback: 1 });
    expect(await listingRow(overdue)).toMatchObject({ product_id: p, visible: 1, norm_status: "fallback" });
    expect(await decisions(overdue)).toEqual([{ product_id: p, method: "identifier", decided_by: "fallback" }]);
    expect((await productRow(p)).published_at).toBe(at);
    expect(await listingRow(inReview)).toMatchObject({ visible: 1, norm_status: "linked" });
    expect((await productRow(own)).published_at).toBe(at);
    expect(await listingRow(recent)).toMatchObject({ visible: 0, norm_status: "pending", product_id: null });
  });
});
