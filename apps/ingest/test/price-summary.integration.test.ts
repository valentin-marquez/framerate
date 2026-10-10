import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { refreshProductsPriceSummary } from "@framerate/database";
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

const GPU = { category: "gpu" as const, title: "ASUS Dual RTX 4070 SUPER OC 12GB", mpn: "DUAL-RTX4070S-O12G" };
// 12:00 en Santiago: el día es 2026-10-05.
const START = "2026-10-05T15:00:00.000Z";

async function product(deps: ReturnType<typeof testDeps>) {
  const [only, ...rest] = await all(deps.db, "products");
  expect(rest).toHaveLength(0);
  if (!only) throw new Error("sin producto");
  return only;
}

/** Lo que haría `framerate-link`: todas las ofertas al mismo producto, publicadas, con su resumen al día. */
async function linkAll(deps: ReturnType<typeof testDeps>, now: Date) {
  const at = now.toISOString();
  const { id } = await deps.db.query
    .insertInto("products")
    .values({ slug: "gpu-1", name: GPU.title, category: "gpu", created_at: at, updated_at: at })
    .returning("id")
    .executeTakeFirstOrThrow();
  await deps.db.query.updateTable("listings").set({ product_id: id, visible: 1, norm_status: "linked" }).execute();
  await refreshProductsPriceSummary(deps.db, [id], now);
}

describe("resumen de precios", () => {
  // Beta publica el producto dos veces: cuenta como una tienda, con y sin stock.
  test("mejor precio entre tiendas sólo con stock; los conteos son de tiendas, no de publicaciones", async () => {
    const clock = steppingClock(START);
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    const beta = fakeStore("beta", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 500_000 })]);
    beta.setOffers([
      offer("beta", "1", { ...GPU, priceCash: 480_000, priceCard: 500_000 }),
      offer("beta", "2", { ...GPU, priceCash: 400_000, inStock: false }),
    ]);
    await crawlCategory(deps, alfa.store, "gpu");
    await crawlCategory(deps, beta.store, "gpu");
    await linkAll(deps, clock());

    expect(await product(deps)).toMatchObject({
      best_price: 480_000,
      best_price_card: 500_000,
      offer_count: 2,
      in_stock_offer_count: 2,
      reference_price: null,
    });
    expect(await all(deps.db, "product_price_daily")).toEqual([
      { product_id: expect.any(Number), day: "2026-10-05", min_cash: 480_000, min_card: 500_000, offer_count: 2 },
    ]);
  });

  test("sin ofertas con stock el mejor precio queda en NULL", async () => {
    const clock = steppingClock(START);
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 500_000 })]);
    await crawlCategory(deps, alfa.store, "gpu");
    await linkAll(deps, clock());
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 480_000, inStock: false })]);
    await crawlCategory(deps, alfa.store, "gpu");

    expect(await product(deps)).toMatchObject({
      best_price: null,
      best_price_card: null,
      offer_count: 1,
      in_stock_offer_count: 0,
    });
  });

  test("la oferta desactivada deja de contar", async () => {
    const clock = steppingClock(START);
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    const beta = fakeStore("beta", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 500_000 })]);
    const kept = offer("beta", "2", { ...GPU, priceCash: 470_000 });
    beta.setOffers([offer("beta", "1", { ...GPU, priceCash: 450_000 }), kept]);
    await crawlCategory(deps, alfa.store, "gpu");
    await crawlCategory(deps, beta.store, "gpu");
    await linkAll(deps, clock());
    beta.setOffers([kept]);
    await crawlCategory(deps, beta.store, "gpu");

    expect(await product(deps)).toMatchObject({ best_price: 470_000, offer_count: 2, in_stock_offer_count: 2 });
  });

  test("el día guarda el mínimo visto entre corridas", async () => {
    const clock = steppingClock(START);
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 500_000 })]);
    await crawlCategory(deps, alfa.store, "gpu");
    await linkAll(deps, clock());
    clock.advance(3 * 3600_000);
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 520_000 })]);
    await crawlCategory(deps, alfa.store, "gpu");

    expect((await product(deps)).best_price).toBe(520_000);
    const [day] = await all(deps.db, "product_price_daily");
    expect(day).toMatchObject({ day: "2026-10-05", min_cash: 500_000, min_card: 500_000, offer_count: 1 });

    // 23:30 del 05 en UTC ya es 20:30 en Santiago: sigue siendo el mismo día.
    clock.advance(5.5 * 3600_000);
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 450_000 })]);
    await crawlCategory(deps, alfa.store, "gpu");
    expect(await all(deps.db, "product_price_daily")).toMatchObject([{ day: "2026-10-05", min_cash: 450_000 }]);
  });

  test("precio habitual: promedio del mínimo diario entre hoy−32 y hoy−3, con al menos 3 días", async () => {
    const clock = steppingClock(START);
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", { ...GPU, priceCash: 500_000 })]);
    await crawlCategory(deps, alfa.store, "gpu");
    await linkAll(deps, clock());
    const { id } = await product(deps);
    const history = async (days: Array<[string, number]>) => {
      await d1.batch(
        days.map(([day, price]) =>
          d1.prepare("INSERT INTO product_price_daily VALUES (?, ?, ?, ?, 1)").bind(id, day, price, price),
        ),
      );
      await crawlCategory(deps, alfa.store, "gpu");
      return (await product(deps)).reference_price;
    };

    // Fuera de la ventana: hoy−2 y hoy−33.
    expect(
      await history([
        ["2026-09-20", 600_000],
        ["2026-09-21", 610_000],
        ["2026-10-03", 100_000],
        ["2026-09-02", 100_000],
      ]),
    ).toBeNull();
    expect(await history([["2026-09-03", 620_000]])).toBe(610_000);
  });
});
