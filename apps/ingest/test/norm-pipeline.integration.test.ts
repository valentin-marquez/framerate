import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { type EnqueuePipelineRequest, NORMALIZER_VERSION, SOURCE_TEXT_MAX } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { crawlCategory } from "@/features/ingestion/crawl-category";
import { normalizeOffer } from "@/features/ingestion/domain/normalize";
import { requestPipeline } from "@/features/ingestion/runtime";
import { toRawOffer } from "@/features/ingestion/stores/woocommerce";
import { fakeStore, offer, steppingClock, testDeps, testEnv } from "./helpers";

/** Lado ingest del pipeline de normalización (#153): hash, upsert liviano, cuarentena, encolado, vínculo en vivo. */

let d1: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const GPU = { category: "gpu" as const, title: "ASUS Dual RTX 4070 SUPER OC 12GB", priceCash: 650_000 };
const SHADOW = { normalize: "shadow", link: "off" } as const;
const SIX_HOURS = 6 * 3600_000;

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

describe("hash de lo relevante", () => {
  test("la primera corrida deja la oferta pending, la encola como nueva y en sombra la sigue vinculando", async () => {
    const deps = testDeps(d1, steppingClock(), SHADOW);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);

    const result = await crawlCategory(deps, alfa.store, "gpu");

    expect(result.stats).toMatchObject({ created: 1, enqueued: 1, newProducts: 1 });
    const listing = await listingOf(deps.db, "1");
    expect(listing).toMatchObject({ norm_status: "pending", crawl_category: "gpu", visible: 1 });
    expect(listing.norm_hash).toHaveLength(64);
    expect(listing.product_id).not.toBeNull();
    expect(deps.sent).toEqual([{ listingId: listing.id, version: NORMALIZER_VERSION, reason: "new" }]);
  });

  test("sin cambios: no reescribe la fila ni encola; sólo avanza last_seen_at", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock, SHADOW);
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

  test("cambio de precio con el mismo hash: punto de precio nuevo, sin encolar", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock, SHADOW);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    await crawlCategory(deps, alfa.store, "gpu");
    await deps.db.query.updateTable("listings").set({ norm_status: "normalized" }).execute();

    clock.advance(SIX_HOURS);
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 629_990 })]);
    const result = await crawlCategory(deps, alfa.store, "gpu");

    expect(result.stats).toMatchObject({ reused: 1, priceChanges: 1, enqueued: 0 });
    expect(await listingOf(deps.db, "1")).toMatchObject({ price_cash: 629_990, norm_status: "normalized" });
    expect(await all(deps.db, "price_points")).toHaveLength(2);
    expect(deps.sent).toHaveLength(1);
  });

  test("cambio de título o de ficha: pending otra vez y encolada como cambiada", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock, SHADOW);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    await crawlCategory(deps, alfa.store, "gpu");
    await deps.db.query.updateTable("listings").set({ norm_status: "normalized" }).execute();
    const { id, norm_hash: first } = await listingOf(deps.db, "1");

    clock.advance(SIX_HOURS);
    alfa.setOffers([offer("alfa", "1", { ...GPU, title: "ASUS Dual RTX 4070 SUPER OC 12GB White" })]);
    const result = await crawlCategory(deps, alfa.store, "gpu");
    expect(result.stats).toMatchObject({ changed: 1, enqueued: 1 });
    const retitled = await listingOf(deps.db, "1");
    expect(retitled.norm_status).toBe("pending");
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
    const deps = testDeps(d1, clock, SHADOW);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    await crawlCategory(deps, alfa.store, "gpu");
    await deps.db.query.updateTable("listings").set({ norm_status: "failed" }).execute();

    clock.advance(SIX_HOURS);
    await crawlCategory(deps, alfa.store, "gpu");
    expect((await listingOf(deps.db, "1")).norm_status).toBe("pending");
    expect(deps.sent.map((m) => m.reason)).toEqual(["new", "changed"]);
  });

  test("con el pipeline apagado guarda el hash pero no encola ni toca el estado", async () => {
    const deps = testDeps(d1, steppingClock());
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    const result = await crawlCategory(deps, alfa.store, "gpu");

    expect(result.stats.enqueued).toBe(0);
    const listing = await listingOf(deps.db, "1");
    expect(listing.norm_status).toBe("legacy");
    expect(listing.norm_hash).toHaveLength(64);
    expect(deps.sent).toEqual([]);
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

describe("PIPELINE_LINK=live", () => {
  test("la oferta nueva nace oculta y sin vínculo; la legacy se sigue vinculando en la corrida", async () => {
    const clock = steppingClock();
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", GPU)]);
    await crawlCategory(testDeps(d1, clock), alfa.store, "gpu");

    clock.advance(SIX_HOURS);
    const live = testDeps(d1, clock, { normalize: "live", link: "live" });
    alfa.setOffers([
      offer("alfa", "1", GPU),
      offer("alfa", "2", { category: "gpu", title: "MSI RTX 4060 Ventus 2X 8GB", priceCash: 320_000 }),
    ]);
    const result = await crawlCategory(live, alfa.store, "gpu");

    expect(result.stats).toMatchObject({ created: 1, reused: 1, enqueued: 1, newProducts: 0, linked: 0 });
    const hidden = await listingOf(live.db, "2");
    expect(hidden).toMatchObject({ visible: 0, product_id: null, norm_status: "pending" });
    expect(await listingOf(live.db, "1")).toMatchObject({ visible: 1, norm_status: "legacy" });
    expect(await all(live.db, "products")).toHaveLength(1);
    expect((await all(live.db, "match_decisions")).some((d) => d.listing_id === hidden.id)).toBe(false);
    expect(live.sent).toEqual([{ listingId: hidden.id, version: NORMALIZER_VERSION, reason: "new" }]);

    // Desaparece antes de normalizarse: se desactiva como cualquier otra.
    clock.advance(SIX_HOURS);
    alfa.setOffers([offer("alfa", "1", GPU)]);
    const next = await crawlCategory(live, alfa.store, "gpu");
    expect(next.stats.deactivated).toBe(1);
    expect((await listingOf(live.db, "2")).is_active).toBe(0);
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
    const [l1, l2, l3] = await Promise.all(["1", "2", "3"].map((id) => listingOf(deps.db, id)));
    if (!l1 || !l2 || !l3) throw new Error("sin ofertas");
    // La 1 tiene identidad vigente; la 2, una de otro hash (el título cambió después).
    await addIdentity(deps.db, l1.id, l1.norm_hash ?? "");
    await addIdentity(deps.db, l2.id, "stale");
    return { db: deps.db, l1, l2, l3 };
  }

  test("pipeline_off cuando la etapa está apagada", async () => {
    const off = testEnv(d1);
    expect(await requestPipeline(off.env, request({}))).toEqual({ ok: false, error: "pipeline_off" });
    const linkOff = testEnv(d1, { PIPELINE_NORMALIZE: "shadow" });
    expect(await requestPipeline(linkOff.env, request({ stage: "link", reason: "relink" }))).toEqual({
      ok: false,
      error: "pipeline_off",
    });
  });

  test("tienda desconocida", async () => {
    const { env, normalize } = testEnv(d1, { PIPELINE_NORMALIZE: "shadow" });
    expect(await requestPipeline(env, request({ store: "no-existe" }))).toEqual({ ok: false, error: "unknown_store" });
    expect(normalize).toEqual([]);
  });

  test("normalize: encola las activas con hash y sin identidad vigente, las deja pending y no las repite", async () => {
    const { db, l2, l3 } = await seed();
    // Sin `norm_hash` (no vista desde el deploy) el consumidor la saltaría: no se encola.
    await db.query.updateTable("listings").set({ norm_hash: null }).where("id", "=", l3.id).execute();
    const { env, normalize } = testEnv(d1, { PIPELINE_NORMALIZE: "shadow" });

    expect(await requestPipeline(env, request({ category: "gpu" }))).toEqual({ ok: true, enqueued: 1 });
    expect(normalize).toEqual([{ listingId: l2.id, version: NORMALIZER_VERSION, reason: "backfill" }]);
    expect((await listingOf(db, "1")).norm_status).toBe("legacy");
    const pending = await listingOf(db, "2");
    expect(pending.norm_status).toBe("pending");
    expect(pending.updated_at > l2.updated_at).toBe(true);
    expect((await listingOf(db, "3")).norm_status).toBe("legacy");

    expect(await requestPipeline(env, request({ category: "gpu" }))).toEqual({ ok: true, enqueued: 0 });
  });

  test("normalize filtra por tienda y respeta el tope", async () => {
    await seed();
    const { env, normalize } = testEnv(d1, { PIPELINE_NORMALIZE: "shadow" });
    expect(await requestPipeline(env, request({ store: "dust2" }))).toEqual({ ok: true, enqueued: 1 });
    expect(await requestPipeline(env, request({ store: "tectec", limit: 1 }))).toEqual({ ok: true, enqueued: 1 });
    expect(normalize).toHaveLength(2);
  });

  test("link: encola con relink sólo lo que tiene identidad vigente, sin tocar el estado", async () => {
    const { db, l1 } = await seed();
    const { env, link, normalize } = testEnv(d1, { PIPELINE_NORMALIZE: "shadow", PIPELINE_LINK: "shadow" });
    expect(await requestPipeline(env, request({ stage: "link", reason: "relink" }))).toEqual({ ok: true, enqueued: 1 });
    expect(link).toEqual([{ listingId: l1.id, version: NORMALIZER_VERSION, reason: "relink" }]);
    expect(normalize).toEqual([]);
    expect((await listingOf(db, "1")).norm_status).toBe("legacy");
  });
});
