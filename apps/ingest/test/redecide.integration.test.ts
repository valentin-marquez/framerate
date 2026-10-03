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
async function forceLink(
  db: Db,
  externalId: string,
  productId: number,
  method: "identifier" | "attributes" = "identifier",
) {
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
      method,
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
    const black = await productOf(deps.db, "b");
    await forceLink(deps.db, "w1", black);

    clock.advance(6 * 3600_000);
    for (const s of [dust2, myshop]) await crawlCategory(deps, s.store, "gpu");
    expect((await listingOf(deps.db, "w1")).product_id).not.toBe(black);
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
  test("sin veto, la oferta más nueva de la misma tienda deja el producto y la más antigua se queda", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const dust2 = fakeStore("dust2", { gpu: ["gpu"] });
    dust2.setOffers([
      offer("dust2", "old", { category: "gpu", title: "MSI GeForce RTX 5060 8G VENTUS 2X OC", priceCash: 383_490 }),
      offer("dust2", "new", {
        category: "gpu",
        title: "Tarjeta de Video MSI RTX 5060 Ventus 2X OC 8GB",
        priceCash: 379_990,
      }),
    ]);
    await crawlCategory(deps, dust2.store, "gpu");
    const product = await productOf(deps.db, "old");
    await forceLink(deps.db, "new", product, "attributes");

    clock.advance(6 * 3600_000);
    await crawlCategory(deps, dust2.store, "gpu");
    expect((await listingOf(deps.db, "old")).product_id).toBe(product);
    expect((await listingOf(deps.db, "new")).product_id).not.toBe(product);
  });

  test("un vínculo que sólo sostiene el identificador que trajo la misma oferta se vuelve a decidir", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const infor = fakeStore("infor", { case: ["case"] });
    const myshop = fakeStore("myshop", { case: ["case"] });
    infor.setOffers([
      offer("infor", "f", { category: "case", title: "Gabinete Lian Li O11 Dynamic EVO", priceCash: 150_000 }),
    ]);
    myshop.setOffers([
      offer("myshop", "l", {
        category: "case",
        title: "Lian Li Lancool 207 Mesh",
        priceCash: 90_000,
        mpn: "G99.LAN207X.00",
      }),
    ]);
    for (const s of [infor, myshop]) await crawlCategory(deps, s.store, "case");
    const product = await productOf(deps.db, "f");
    await forceLink(deps.db, "l", product);

    clock.advance(6 * 3600_000);
    for (const s of [infor, myshop]) await crawlCategory(deps, s.store, "case");
    expect((await listingOf(deps.db, "f")).product_id).toBe(product);
    expect((await listingOf(deps.db, "l")).product_id).not.toBe(product);
    const ids = (await all(deps.db, "product_identifiers")).filter((i) => i.product_id === product);
    expect(ids).toEqual([]);
  });

  test("la oferta vetada se va sin quitarle al producto el MPN que publican sus hermanas", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const mpn = "AX4U32008G16A-SWHD35";
    const stores = [
      fakeStore("infor", { ram: ["ram"] }),
      fakeStore("pcfactory", { ram: ["ram"] }),
      fakeStore("myshop", { ram: ["ram"] }),
      fakeStore("notebookstore", { ram: ["ram"] }),
    ] as const;
    const [infor, pcfactory, myshop, notebookstore] = stores;
    const ram = { category: "ram" as const, priceCash: 30_000 };
    infor.setOffers([offer("infor", "f", { ...ram, title: "MEMORIA ADATA XPG GAMMIX D35 8GB 3200MHz WH" })]);
    pcfactory.setOffers([
      offer("pcfactory", "s1", { ...ram, title: "Memoria RAM DDR4 8 GB 3200 MHz UDIMM WHITE", mpn }),
    ]);
    myshop.setOffers([
      offer("myshop", "s2", {
        ...ram,
        title: "Memoria RAM DIMM 8 GB - DDR4 3200 MT/s - XPG Gammix D35 White (AX4U32008G16A-SWHD35)",
        mpn,
      }),
    ]);
    // La tienda no escribe el color: el extractor la lee negra.
    notebookstore.setOffers([
      offer("notebookstore", "s3", { ...ram, title: "Memoria Ram 8GB DDR4 3200MHz CL16 Dimm Adata", mpn }),
    ]);
    for (const s of stores) await crawlCategory(deps, s.store, "ram");
    const product = await productOf(deps.db, "f");
    for (const id of ["s1", "s2", "s3"]) await forceLink(deps.db, id, product);
    const mpnOwner = async () =>
      (await all(deps.db, "product_identifiers")).find((i) => i.kind === "mpn" && i.value === "AX4U32008G16ASWHD35")
        ?.product_id;
    expect(await mpnOwner()).toBe(product);

    clock.advance(6 * 3600_000);
    for (const s of stores) await crawlCategory(deps, s.store, "ram");
    expect((await listingOf(deps.db, "s3")).product_id).not.toBe(product);
    expect(await mpnOwner()).toBe(product);

    clock.advance(6 * 3600_000);
    for (const s of stores) await crawlCategory(deps, s.store, "ram");
    expect((await listingOf(deps.db, "s1")).product_id).toBe(product);
    expect((await listingOf(deps.db, "s2")).product_id).toBe(product);
    expect((await listingOf(deps.db, "f")).product_id).toBe(product);
  });
});

describe("revisiones obsoletas", () => {
  async function setupReview() {
    const deps = testDeps(d1, steppingClock());
    const alfa = fakeStore("alfa", { ram: ["ram"] });
    const beta = fakeStore("beta", { ram: ["ram"] });
    alfa.setOffers([
      offer("alfa", "1", {
        category: "ram",
        title: "Corsair Vengeance 32GB 2x16GB DDR5 6000MHz Black",
        priceCash: 180_000,
      }),
    ]);
    const betaOffer = (title: string) =>
      offer("beta", "2", { category: "ram", title, priceCash: 150_000, gtin: "0840006600008" });
    beta.setOffers([betaOffer("Corsair Vengeance 32GB (2x16GB) DDR5 6000MHz CMK32GX5M2B6000C36")]);
    await crawlCategory(deps, alfa.store, "ram");
    await crawlCategory(deps, beta.store, "ram");
    const [review] = await all(deps.db, "match_reviews");
    if (review?.status !== "pending") throw new Error("sin revisión pendiente");
    return { deps, beta, betaOffer, review };
  }

  test("una revisión cuyo par hoy se veta se cierra como rechazada", async () => {
    const { deps, beta, betaOffer } = await setupReview();
    beta.setOffers([betaOffer("Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz CMK32GX5M2B6000C36")]);
    const result = await crawlCategory(deps, beta.store, "ram");
    const [review] = await all(deps.db, "match_reviews");
    expect(review?.status).toBe("rejected");
    expect(review?.resolved_at).not.toBeNull();
    expect(result.stats.reviewsClosed).toBe(1);
  });

  test("una revisión cuya oferta ya está en el candidato se cierra como aceptada", async () => {
    const { deps, beta, review } = await setupReview();
    await deps.db.query
      .updateTable("listings")
      .set({ product_id: review.candidate_product_id })
      .where("id", "=", review.listing_id)
      .execute();
    const result = await crawlCategory(deps, beta.store, "ram");
    const [closed] = await all(deps.db, "match_reviews");
    expect(closed?.status).toBe("accepted");
    expect(closed?.resolved_at).not.toBeNull();
    expect(result.stats.reviewsClosed).toBe(1);
  });

  test("una revisión que sigue vigente no se toca", async () => {
    const { deps, beta } = await setupReview();
    const decisions = (await all(deps.db, "match_decisions")).length;
    const result = await crawlCategory(deps, beta.store, "ram");
    expect((await all(deps.db, "match_reviews"))[0]?.status).toBe("pending");
    expect(await all(deps.db, "match_decisions")).toHaveLength(decisions);
    expect(result.stats.reviewsClosed).toBe(0);
  });
});
