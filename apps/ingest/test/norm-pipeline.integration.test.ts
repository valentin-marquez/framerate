import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { type EnqueuePipelineRequest, NORMALIZER_VERSION, SOURCE_TEXT_MAX } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { crawlCategory } from "@/features/ingestion/crawl-category";
import { normalizeOffer } from "@/features/ingestion/domain/normalize";
import { requestPipeline, retryStuckNormalize } from "@/features/ingestion/runtime";
import { toRawOffer } from "@/features/ingestion/stores/woocommerce";
import { fakeStore, offer, steppingClock, testDeps, testEnv } from "./helpers";

/** Lado ingest del pipeline de normalización (#153, #156): hash, upsert liviano, cuarentena, encolado, reintento. */

let d1: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const GPU = { category: "gpu" as const, title: "ASUS Dual RTX 4070 SUPER OC 12GB", priceCash: 650_000 };
const SIX_HOURS = 6 * 3600_000;
const HOUR = 3600_000;

async function listingOf(db: Db, externalId: string) {
  const listing = (await all(db, "listings")).find((l) => l.external_id === externalId);
  if (!listing) throw new Error(`sin oferta ${externalId}`);
  return listing;
}

async function addIdentity(db: Db, listingId: number, inputHash: string) {
  await db.query
    .insertInto("listing_identity")
    .values({
      listing_id: listingId,
      version: NORMALIZER_VERSION,
      input_hash: inputHash,
      model: "test",
      category: "gpu",
      brand: "asus",
      name: "ASUS Dual GeForce RTX 4070 SUPER OC 12GB",
      mpn: null,
      confidence: "high",
      identity: "{}",
      identity_raw: "{}",
      specs: "{}",
      specs_source: "{}",
      created_at: "2026-09-01T00:00:00.000Z",
    })
    .execute();
}

describe("la corrida no vincula: encola", () => {
  test("la oferta nueva nace oculta, pending y sin producto; se encola como nueva", async () => {
    const deps = testDeps(d1, steppingClock());
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);

    const result = await crawlCategory(deps, alfa.store, "gpu");

    expect(result.stats).toMatchObject({ created: 1, enqueued: 1 });
    const listing = await listingOf(deps.db, "1");
    expect(listing).toMatchObject({ norm_status: "pending", crawl_category: "gpu", visible: 0, product_id: null });
    expect(listing.norm_hash).toHaveLength(64);
    expect(await all(deps.db, "products")).toHaveLength(0);
    expect(await all(deps.db, "match_decisions")).toHaveLength(0);
    expect(deps.sent).toEqual([{ listingId: listing.id, version: NORMALIZER_VERSION, reason: "new" }]);
  });

  test("sin cambios: no reescribe la fila ni encola; sólo avanza last_seen_at", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    await crawlCategory(deps, alfa.store, "gpu");
    const before = await listingOf(deps.db, "1");

    clock.advance(SIX_HOURS);
    const result = await crawlCategory(deps, alfa.store, "gpu");

    expect(result.stats).toMatchObject({ updated: 1, reused: 1, changed: 0, enqueued: 0, priceChanges: 0 });
    const after = await listingOf(deps.db, "1");
    expect(after.updated_at).toBe(before.updated_at);
    expect(after.norm_hash).toBe(before.norm_hash);
    expect(after.last_seen_at > before.last_seen_at).toBe(true);
    expect(await all(deps.db, "price_points")).toHaveLength(1);
    expect(deps.sent).toHaveLength(1);
  });

  test("cambio de precio con el mismo hash: punto de precio nuevo, sin encolar ni tocar el estado", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    await crawlCategory(deps, alfa.store, "gpu");
    await deps.db.query.updateTable("listings").set({ norm_status: "linked", visible: 1 }).execute();

    clock.advance(SIX_HOURS);
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 629_990 })]);
    const result = await crawlCategory(deps, alfa.store, "gpu");

    expect(result.stats).toMatchObject({ reused: 1, priceChanges: 1, enqueued: 0 });
    expect(await listingOf(deps.db, "1")).toMatchObject({ price_cash: 629_990, norm_status: "linked", visible: 1 });
    expect(await all(deps.db, "price_points")).toHaveLength(2);
    expect(deps.sent).toHaveLength(1);
  });

  test("cambio de título o de ficha: pending otra vez y encolada como cambiada, sin ocultarla", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    await crawlCategory(deps, alfa.store, "gpu");
    await deps.db.query.updateTable("listings").set({ norm_status: "linked", visible: 1 }).execute();
    const { id, norm_hash: first } = await listingOf(deps.db, "1");

    clock.advance(SIX_HOURS);
    alfa.setOffers([offer("alfa", "1", { ...GPU, title: "ASUS Dual RTX 4070 SUPER OC 12GB White" })]);
    const result = await crawlCategory(deps, alfa.store, "gpu");
    expect(result.stats).toMatchObject({ changed: 1, enqueued: 1 });
    const retitled = await listingOf(deps.db, "1");
    expect(retitled).toMatchObject({ norm_status: "pending", visible: 1 });
    expect(retitled.norm_hash).not.toBe(first);
    expect(deps.sent[1]).toEqual({ listingId: id, version: NORMALIZER_VERSION, reason: "changed" });

    clock.advance(SIX_HOURS);
    alfa.setOffers([
      offer("alfa", "1", { ...GPU, title: "ASUS Dual RTX 4070 SUPER OC 12GB White", sourceText: "Ficha nueva" }),
    ]);
    await crawlCategory(deps, alfa.store, "gpu");
    expect((await listingOf(deps.db, "1")).norm_hash).not.toBe(retitled.norm_hash);
    expect(deps.sent).toHaveLength(3);
  });

  test("una oferta failed se reintenta en la siguiente corrida aunque no cambie", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    await crawlCategory(deps, alfa.store, "gpu");
    await deps.db.query.updateTable("listings").set({ norm_status: "failed" }).execute();

    clock.advance(SIX_HOURS);
    await crawlCategory(deps, alfa.store, "gpu");
    expect((await listingOf(deps.db, "1")).norm_status).toBe("pending");
    expect(deps.sent.map((m) => m.reason)).toEqual(["new", "changed"]);
  });

  test("la oferta que desaparece antes de normalizarse se desactiva como cualquier otra", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([
      offer("alfa", "1", GPU),
      offer("alfa", "2", { category: "gpu", title: "MSI RTX 4060 Ventus 2X 8GB", priceCash: 320_000 }),
    ]);
    await crawlCategory(deps, alfa.store, "gpu");

    clock.advance(SIX_HOURS);
    alfa.setOffers([offer("alfa", "1", GPU)]);
    const next = await crawlCategory(deps, alfa.store, "gpu");
    expect(next.stats.deactivated).toBe(1);
    expect((await listingOf(deps.db, "2")).is_active).toBe(0);
  });
});

describe("cuarentena sin repetir", () => {
  test("el mismo rechazo en dos corridas es una sola fila; cambia el título y es otra", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    const accessory = { category: "gpu" as const, title: "Soporte anti-sag para GPU", priceCash: 15_000 };
    alfa.setOffers([offer("alfa", "1", accessory)]);

    const first = await crawlCategory(deps, alfa.store, "gpu");
    clock.advance(SIX_HOURS);
    const second = await crawlCategory(deps, alfa.store, "gpu");

    expect(first.stats).toMatchObject({ quarantined: 1, quarantineNew: 1 });
    expect(second.stats).toMatchObject({ quarantined: 1, quarantineNew: 0 });
    expect(await all(deps.db, "quarantine")).toHaveLength(1);

    alfa.setOffers([offer("alfa", "1", { ...accessory, title: "Soporte anti-sag para GPU v2" })]);
    await crawlCategory(deps, alfa.store, "gpu");
    expect(await all(deps.db, "quarantine")).toHaveLength(2);
  });
});

describe("source_text", () => {
  test("WooCommerce entrega la descripción sin HTML y la oferta la guarda recortada", async () => {
    const raw = toRawOffer(
      {
        id: 1,
        name: GPU.title,
        permalink: "https://alfa.example/p/1",
        sku: "",
        is_in_stock: true,
        prices: { price: "649990", regular_price: "649990", currency_minor_unit: 0 },
        images: [],
        attributes: [],
        description: `<p>Ficha <b>larga</b> &amp; completa</p>${"x".repeat(SOURCE_TEXT_MAX)}`,
      },
      "gpu",
      { sku: "internal" },
    );
    expect(raw.sourceText?.startsWith("Ficha larga & completa")).toBe(true);

    const result = normalizeOffer(raw, "gpu");
    if (!result.ok) throw new Error(result.reason);
    expect(result.offer.sourceText).toHaveLength(SOURCE_TEXT_MAX);

    const deps = testDeps(d1, steppingClock());
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([raw]);
    await crawlCategory(deps, alfa.store, "gpu");
    expect((await listingOf(deps.db, "1")).source_text).toHaveLength(SOURCE_TEXT_MAX);
  });
});

describe("reintento de lo atascado (Cron)", () => {
  async function seed() {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers(
      ["pending", "normalized", "linked", "failed", "reciente", "inactiva"].map((id, i) =>
        offer("alfa", id, { category: "gpu", title: `MSI RTX 40${60 + i} Ventus 2X 8GB`, priceCash: 300_000 + i }),
      ),
    );
    await crawlCategory(deps, alfa.store, "gpu");
    const db = deps.db;
    const set = (externalId: string, patch: Record<string, unknown>) =>
      db.query.updateTable("listings").set(patch).where("external_id", "=", externalId).execute();
    await set("normalized", { norm_status: "normalized" });
    await set("linked", { norm_status: "linked" });
    await set("failed", { norm_status: "failed" });
    await set("inactiva", { is_active: 0 });
    clock.advance(25 * HOUR);
    await set("reciente", { updated_at: clock().toISOString() });
    return { db, clock };
  }

  test("vuelve a encolar las activas con más de 24 h pending o normalized; no las failed", async () => {
    const { db, clock } = await seed();
    const { env, normalize } = testEnv(d1);

    expect(await retryStuckNormalize(env, clock())).toBe(2);
    const retried = await Promise.all(
      normalize.map((m) =>
        db.query.selectFrom("listings").selectAll().where("id", "=", m.listingId).executeTakeFirstOrThrow(),
      ),
    );
    expect(retried.map((l) => l.external_id).sort()).toEqual(["normalized", "pending"]);
    expect(normalize.every((m) => m.reason === "changed" && m.version === NORMALIZER_VERSION)).toBe(true);
    // El estado no cambia: una `normalized` con identidad vigente la reenvía el normalizador al vínculo.
    expect(retried.map((l) => l.norm_status).sort()).toEqual(["normalized", "pending"]);

    // Con `updated_at` avanzado, el próximo Cron no las repite.
    expect(await retryStuckNormalize(env, clock())).toBe(0);
    expect(normalize).toHaveLength(2);
  });
});

describe("RPC enqueuePipeline", () => {
  const request = (patch: Partial<EnqueuePipelineRequest>) => ({
    stage: "normalize" as const,
    reason: "backfill" as const,
    limit: 500,
    requestedBy: "test",
    ...patch,
  });

  async function seed() {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const tectec = fakeStore("tectec", { gpu: ["gpu"] });
    const dust2 = fakeStore("dust2", { gpu: ["gpu"] });
    tectec.setOffers([
      offer("tectec", "1", GPU),
      offer("tectec", "2", { category: "gpu", title: "MSI RTX 4060 Ventus 2X 8GB", priceCash: 320_000 }),
    ]);
    dust2.setOffers([
      offer("dust2", "3", { category: "gpu", title: "Gigabyte RTX 4060 Eagle OC 8GB", priceCash: 330_000 }),
    ]);
    await crawlCategory(deps, tectec.store, "gpu");
    await crawlCategory(deps, dust2.store, "gpu");
    // Ya pasaron por el pipeline: el backfill es para lo que no está en cola.
    await deps.db.query.updateTable("listings").set({ norm_status: "linked" }).execute();
    const [l1, l2, l3] = await Promise.all(["1", "2", "3"].map((id) => listingOf(deps.db, id)));
    if (!l1 || !l2 || !l3) throw new Error("sin ofertas");
    // La 1 tiene identidad vigente; la 2, una de otro hash (el título cambió después).
    await addIdentity(deps.db, l1.id, l1.norm_hash ?? "");
    await addIdentity(deps.db, l2.id, "stale");
    return { db: deps.db, l1, l2, l3 };
  }

  test("tienda desconocida", async () => {
    const { env, normalize } = testEnv(d1);
    expect(await requestPipeline(env, request({ store: "no-existe" }))).toEqual({ ok: false, error: "unknown_store" });
    expect(normalize).toEqual([]);
  });

  test("normalize: encola las activas con hash y sin identidad vigente, las deja pending y no las repite", async () => {
    const { db, l2, l3 } = await seed();
    // Sin `norm_hash` (no vista desde el deploy) el consumidor la saltaría: no se encola.
    await db.query.updateTable("listings").set({ norm_hash: null }).where("id", "=", l3.id).execute();
    const { env, normalize } = testEnv(d1);

    expect(await requestPipeline(env, request({ category: "gpu" }))).toEqual({ ok: true, enqueued: 1 });
    expect(normalize).toEqual([{ listingId: l2.id, version: NORMALIZER_VERSION, reason: "backfill" }]);
    expect((await listingOf(db, "1")).norm_status).toBe("linked");
    const pending = await listingOf(db, "2");
    expect(pending.norm_status).toBe("pending");
    expect(pending.updated_at > l2.updated_at).toBe(true);
    expect((await listingOf(db, "3")).norm_status).toBe("linked");

    expect(await requestPipeline(env, request({ category: "gpu" }))).toEqual({ ok: true, enqueued: 0 });
  });

  test("normalize filtra por tienda y respeta el tope", async () => {
    await seed();
    const { env, normalize } = testEnv(d1);
    expect(await requestPipeline(env, request({ store: "dust2" }))).toEqual({ ok: true, enqueued: 1 });
    expect(await requestPipeline(env, request({ store: "tectec", limit: 1 }))).toEqual({ ok: true, enqueued: 1 });
    expect(normalize).toHaveLength(2);
  });

  test("link: encola con relink sólo lo que tiene identidad vigente, sin tocar el estado", async () => {
    const { db, l1 } = await seed();
    const { env, link, normalize } = testEnv(d1);
    expect(await requestPipeline(env, request({ stage: "link", reason: "relink" }))).toEqual({ ok: true, enqueued: 1 });
    expect(link).toEqual([{ listingId: l1.id, version: NORMALIZER_VERSION, reason: "relink" }]);
    expect(normalize).toEqual([]);
    expect((await listingOf(db, "1")).norm_status).toBe("linked");
  });
});
