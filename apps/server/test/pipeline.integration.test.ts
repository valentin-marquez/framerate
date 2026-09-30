import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { crawlCategory } from "@/features/ingestion/crawl-category";
import { resolveMatchReview } from "@/features/matching/reviews";
import {
  listings,
  matchDecisions,
  matchReviews,
  pricePoints,
  productIdentifiers,
  products,
  quarantine,
} from "@/shared/db/schema";
import { createTestD1, fakeStore, offer, resetD1, steppingClock, testDeps } from "./helpers";

/**
 * Pipeline completo contra D1 real: tienda → normalización → oferta →
 * historial de precios → matching → producto canónico.
 */

let d1: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const GPU_A = { category: "gpu" as const, title: "ASUS Dual RTX 4070 SUPER OC 12GB", priceCash: 650_000 };

describe("ingesta", () => {
  test("primera corrida crea ofertas, productos y un punto de precio por oferta", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const tienda = fakeStore("alfa", { gpu: ["gpu"] });
    tienda.setOffers([
      offer("alfa", "1", { ...GPU_A, mpn: "DUAL-RTX4070S-O12G" }),
      offer("alfa", "2", { category: "gpu", title: "MSI RTX 4060 Ventus 2X 8GB", priceCash: 320_000 }),
      offer("alfa", "3", { category: "gpu", title: "Soporte anti-sag para GPU", priceCash: 15_000 }),
    ]);

    const result = await crawlCategory(deps, tienda.store, "gpu");

    expect(result.status).toBe("succeeded");
    expect(result.stats).toMatchObject({ seen: 3, valid: 2, quarantined: 1, created: 2, newProducts: 2 });
    expect(await deps.db.select().from(products)).toHaveLength(2);
    expect(await deps.db.select().from(pricePoints)).toHaveLength(2);
    const [q] = await deps.db.select().from(quarantine);
    expect(q?.reason).toBe("price:out_of_range");
  });

  test("segunda corrida: sólo registra precio si cambió y desactiva lo que desapareció", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const tienda = fakeStore("alfa", { gpu: ["gpu"] });
    const second = offer("alfa", "2", { category: "gpu", title: "MSI RTX 4060 Ventus 2X 8GB", priceCash: 320_000 });
    const third = offer("alfa", "3", { category: "gpu", title: "Gigabyte RTX 4060 Eagle OC 8GB", priceCash: 330_000 });
    tienda.setOffers([offer("alfa", "1", GPU_A), second, third]);
    await crawlCategory(deps, tienda.store, "gpu");

    clock.advance(6 * 3600_000);
    tienda.setOffers([offer("alfa", "1", { ...GPU_A, priceCash: 629_990 }), second]);
    const result = await crawlCategory(deps, tienda.store, "gpu");

    expect(result.stats).toMatchObject({ valid: 2, updated: 2, priceChanges: 1, deactivated: 1 });
    expect(await deps.db.select().from(pricePoints)).toHaveLength(4);
    const gone = await deps.db.select().from(listings).where(eq(listings.externalId, "3")).get();
    expect(gone?.isActive).toBe(false);
  });

  test("guardia de salud: una corrida incompleta no vacía el catálogo de la tienda", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const tienda = fakeStore("alfa", { cpu: ["cpu"] });
    const models = ["5600", "5600X", "7600", "7600X", "7800X3D", "9700X"];
    tienda.setOffers(
      models.map((m, i) =>
        offer("alfa", String(i), { category: "cpu", title: `AMD Ryzen 5 ${m}`, priceCash: 150_000 }),
      ),
    );
    await crawlCategory(deps, tienda.store, "cpu");

    tienda.setOffers([offer("alfa", "0", { category: "cpu", title: "AMD Ryzen 5 5600", priceCash: 150_000 })]);
    const partial = await crawlCategory(deps, tienda.store, "cpu");
    expect(partial.stats.deactivationSkipped).toBe(true);
    expect(partial.stats.deactivated).toBe(0);

    tienda.setOffers([]);
    const empty = await crawlCategory(deps, tienda.store, "cpu");
    expect(empty.status).toBe("failed");
    const active = await deps.db.select().from(listings).where(eq(listings.isActive, true));
    expect(active).toHaveLength(models.length);
  });

  test("una tienda que falla deja la corrida marcada como fallida", async () => {
    const deps = testDeps(d1, steppingClock());
    const tienda = fakeStore("alfa", { gpu: ["gpu"] });
    tienda.fail(new Error("HTTP 503"));
    const result = await crawlCategory(deps, tienda.store, "gpu");
    expect(result).toMatchObject({ status: "failed", error: "HTTP 503" });
  });
});

describe("matching entre tiendas", () => {
  test("mismo MPN con distinto formato en dos tiendas → un solo producto", async () => {
    const deps = testDeps(d1, steppingClock());
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    const beta = fakeStore("beta", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", { ...GPU_A, mpn: "DUAL-RTX4070S-O12G" })]);
    beta.setOffers([
      offer("beta", "x9", {
        category: "gpu",
        title: "Tarjeta de Video Asus Dual GeForce RTX4070 Super O12G",
        priceCash: 639_990,
        mpn: "dual rtx4070s o12g",
      }),
    ]);
    await crawlCategory(deps, alfa.store, "gpu");
    const result = await crawlCategory(deps, beta.store, "gpu");

    expect(result.stats.linked).toBe(1);
    expect(await deps.db.select().from(products)).toHaveLength(1);
    const decisions = await deps.db.select().from(matchDecisions);
    expect(decisions.map((d) => d.method).sort()).toEqual(["identifier", "new_product"]);
  });

  test("CPU se fusiona por modelo aunque ninguna tienda publique MPN", async () => {
    const deps = testDeps(d1, steppingClock());
    const alfa = fakeStore("alfa", { cpu: ["cpu"] });
    const beta = fakeStore("beta", { cpu: ["cpu"] });
    alfa.setOffers([
      offer("alfa", "1", { category: "cpu", title: "Procesador AMD Ryzen 7 7800X3D AM5", priceCash: 420_000 }),
    ]);
    beta.setOffers([
      offer("beta", "2", { category: "cpu", title: "AMD RYZEN 7 7800X3D 4.2GHz Box", priceCash: 415_000 }),
    ]);
    await crawlCategory(deps, alfa.store, "cpu");
    await crawlCategory(deps, beta.store, "cpu");
    expect(await deps.db.select().from(products)).toHaveLength(1);
  });

  test("mismo MPN pero distinta VRAM → productos distintos, sin robar el identificador", async () => {
    const deps = testDeps(d1, steppingClock());
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    const beta = fakeStore("beta", { gpu: ["gpu"] });
    alfa.setOffers([
      offer("alfa", "1", {
        category: "gpu",
        title: "MSI RTX 4060 Ti Ventus 2X 8GB",
        priceCash: 400_000,
        mpn: "V515-015R",
      }),
    ]);
    beta.setOffers([
      offer("beta", "2", {
        category: "gpu",
        title: "MSI RTX 4060 Ti Ventus 2X 16GB",
        priceCash: 480_000,
        mpn: "V515-015R",
      }),
    ]);
    await crawlCategory(deps, alfa.store, "gpu");
    await crawlCategory(deps, beta.store, "gpu");

    const all = await deps.db.select().from(products);
    expect(all).toHaveLength(2);
    const ids = await deps.db.select().from(productIdentifiers);
    expect(ids).toHaveLength(1);
    const conflict = await deps.db.select().from(matchDecisions).where(eq(matchDecisions.method, "new_product"));
    expect(conflict.some((d) => JSON.stringify(d.evidence).includes("identifierConflicts"))).toBe(true);
  });

  test("si la tienda corrige el título y el vínculo ya no es válido, se desvincula y re-decide", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const alfa = fakeStore("alfa", { gpu: ["gpu"] });
    const beta = fakeStore("beta", { gpu: ["gpu"] });
    alfa.setOffers([offer("alfa", "1", { ...GPU_A, mpn: "DUAL-RTX4070S-O12G" })]);
    beta.setOffers([offer("beta", "2", { ...GPU_A, mpn: "DUAL-RTX4070S-O12G" })]);
    await crawlCategory(deps, alfa.store, "gpu");
    await crawlCategory(deps, beta.store, "gpu");
    expect(await deps.db.select().from(products)).toHaveLength(1);

    // Beta tenía mal el título: en realidad es la versión de 16GB (otro producto).
    beta.setOffers([offer("beta", "2", { ...GPU_A, title: "ASUS Dual RTX 4070 Ti SUPER OC 16GB", mpn: null })]);
    const result = await crawlCategory(deps, beta.store, "gpu");
    expect(result.stats).toMatchObject({ unlinked: 1, newProducts: 1 });
    expect(await deps.db.select().from(products)).toHaveLength(2);
  });
});

describe("revisión humana", () => {
  async function setupReview() {
    const deps = testDeps(d1, steppingClock());
    const alfa = fakeStore("alfa", { ram: ["ram"] });
    const beta = fakeStore("beta", { ram: ["ram"] });
    alfa.setOffers([
      offer("alfa", "1", {
        category: "ram",
        title: "Corsair Dominator Titanium 32GB 2x16GB DDR5 6000MHz",
        priceCash: 180_000,
      }),
    ]);
    beta.setOffers([
      offer("beta", "2", {
        category: "ram",
        title: "Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz",
        priceCash: 150_000,
        gtin: "0840006600008",
      }),
    ]);
    await crawlCategory(deps, alfa.store, "ram");
    const result = await crawlCategory(deps, beta.store, "ram");
    const [review] = await deps.db.select().from(matchReviews);
    return { deps, result, review };
  }

  test("caso dudoso crea producto provisional visible + revisión pendiente", async () => {
    const { deps, result, review } = await setupReview();
    expect(result.stats).toMatchObject({ reviews: 1, newProducts: 1 });
    expect(review?.status).toBe("pending");
    expect(await deps.db.select().from(products)).toHaveLength(2);
  });

  test("aceptar mueve la oferta al candidato y le traslada sus identificadores", async () => {
    const { deps, review } = await setupReview();
    if (!review) throw new Error("se esperaba una revisión");
    await resolveMatchReview(deps.db, {
      reviewId: review.id,
      action: "accept",
      decidedBy: "test",
      now: new Date().toISOString(),
    });

    const listing = await deps.db.select().from(listings).where(eq(listings.id, review.listingId)).get();
    expect(listing?.productId).toBe(review.candidateProductId);
    const ids = await deps.db.select().from(productIdentifiers);
    expect(ids).toEqual([{ kind: "gtin", value: "00840006600008", productId: review.candidateProductId }]);
    await expect(
      resolveMatchReview(deps.db, { reviewId: review.id, action: "reject", decidedBy: "test", now: "" }),
    ).rejects.toMatchObject({ code: "review_already_resolved" });
  });
});
