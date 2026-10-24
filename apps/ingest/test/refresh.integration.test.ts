import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { catalogVersion, refreshProductsPriceSummary } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { crawlCategory } from "@/features/ingestion/crawl-category";
import type { RawOffer } from "@/features/ingestion/domain/normalize";
import { refreshStore } from "@/features/ingestion/refresh-store";
import { fakeStore, offer, steppingClock, testDeps } from "./helpers";

let d1: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const GPUS = [
  { title: "ASUS Dual RTX 4070 SUPER OC 12GB", mpn: "DUAL-RTX4070S-O12G" },
  { title: "MSI GeForce RTX 4060 VENTUS 2X 8G OC", mpn: "RTX 4060 VENTUS 2X 8G OC" },
  { title: "Gigabyte RTX 4060 Ti EAGLE OC 8G", mpn: "GV-N406TEAGLE OC-8GD" },
].map((g) => ({ ...g, category: "gpu" as const }));

/** Tres ofertas crawleadas, cada una vinculada a su producto como haría `framerate-link`. */
async function setup() {
  const clock = steppingClock("2026-10-24T15:00:00.000Z");
  const deps = testDeps(d1, clock);
  const tienda = fakeStore("alfa", { gpu: ["gpu"] });
  tienda.setOffers(GPUS.map((g, i) => offer("alfa", String(i + 1), { ...g, priceCash: 500_000 + i })));
  await crawlCategory(deps, tienda.store, "gpu");
  for (const listing of await all(deps.db, "listings")) {
    const at = clock().toISOString();
    const { id } = await deps.db.query
      .insertInto("products")
      .values({ slug: `gpu-${listing.id}`, name: listing.title, category: "gpu", created_at: at, updated_at: at })
      .returning("id")
      .executeTakeFirstOrThrow();
    await deps.db.query
      .updateTable("listings")
      .set({ product_id: id, visible: 1, norm_status: "linked" })
      .where("id", "=", listing.id)
      .execute();
    await refreshProductsPriceSummary(deps.db, [id], clock());
  }
  let refreshed: Array<Partial<RawOffer>> = [];
  tienda.store.adapter.refreshOffers = async function* (refs) {
    for (const raw of refreshed) {
      const ref = refs.find((r) => r.externalId === raw.externalId);
      if (ref) yield { ...raw, category: ref.category } as RawOffer;
    }
  };
  const agedVersion = () => d1.prepare("UPDATE catalog_version SET bumped_at = '2026-01-01T00:00:00.000Z'").run();
  return {
    deps,
    store: tienda.store,
    agedVersion,
    returns(next: Array<Partial<RawOffer>>) {
      refreshed = next;
    },
  };
}

const pricePoints = async (deps: ReturnType<typeof testDeps>) => (await all(deps.db, "price_points")).length;

describe("refresco liviano", () => {
  test("actualiza sólo lo que cambió, deja quieto lo omitido y manda lo inválido a cuarentena", async () => {
    const s = await setup();
    const before = await pricePoints(s.deps);
    await s.agedVersion();
    const version = await catalogVersion(s.deps.db);
    s.returns([
      offer("alfa", "1", { ...GPUS[0], priceCash: 450_000 }),
      // La 2 no vuelve; la 3 vuelve sin precio.
      offer("alfa", "3", { ...GPUS[2], priceCash: 0 }),
    ]);

    const result = await refreshStore(s.deps, s.store);

    expect(result).toMatchObject({
      status: "succeeded",
      stats: { requested: 3, fetched: 2, changed: 1, missing: 1, quarantined: 1 },
    });
    expect(await pricePoints(s.deps)).toBe(before + 1);
    const listings = await all(s.deps.db, "listings");
    expect(listings.map((l) => [l.external_id, l.price_cash, l.is_active])).toEqual([
      ["1", 450_000, 1],
      ["2", 500_001, 1],
      ["3", 500_002, 1],
    ]);
    const products = await all(s.deps.db, "products");
    expect(products.find((p) => p.id === listings[0]?.product_id)?.best_price).toBe(450_000);
    expect(await all(s.deps.db, "quarantine")).toEqual([expect.objectContaining({ run_id: result.runId })]);
    expect(await catalogVersion(s.deps.db)).toBe(version + 1);
    const [run] = (await all(s.deps.db, "crawl_runs")).filter((r) => r.id === result.runId);
    expect(run).toMatchObject({ category: "refresh", status: "succeeded" });
    expect(JSON.parse(run?.stats ?? "{}")).toEqual(result.stats);
  });

  test("sin cambios no escribe puntos de precio ni sube la versión", async () => {
    const s = await setup();
    const before = await pricePoints(s.deps);
    await s.agedVersion();
    const version = await catalogVersion(s.deps.db);
    s.returns(GPUS.map((g, i) => offer("alfa", String(i + 1), { ...g, priceCash: 500_000 + i })));

    expect((await refreshStore(s.deps, s.store)).stats).toMatchObject({ fetched: 3, changed: 0 });
    expect(await pricePoints(s.deps)).toBe(before);
    expect(await catalogVersion(s.deps.db)).toBe(version);
  });

  test("con una subida de versión reciente, el cambio se guarda pero la versión espera", async () => {
    const s = await setup();
    const version = await catalogVersion(s.deps.db);
    s.returns([offer("alfa", "1", { ...GPUS[0], priceCash: 450_000 })]);

    expect((await refreshStore(s.deps, s.store)).stats.changed).toBe(1);
    expect(await catalogVersion(s.deps.db)).toBe(version);
  });

  test("si la tienda no devuelve ninguna de las pedidas, la corrida falla y no toca nada", async () => {
    const s = await setup();
    const before = await all(s.deps.db, "listings");
    s.returns([]);

    expect(await refreshStore(s.deps, s.store)).toMatchObject({
      status: "failed",
      stats: { requested: 3, fetched: 0 },
    });
    expect(await all(s.deps.db, "listings")).toEqual(before);
  });
});
