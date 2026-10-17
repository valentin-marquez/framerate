import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { crawlCategory } from "@/features/ingestion/crawl-category";
import {
  closeStuckRuns,
  deactivateStale,
  ensureStore,
  purgeQuarantine,
  startRun,
} from "@/features/ingestion/ingestion.repository";
import { fakeStore, offer, steppingClock, testDeps } from "./helpers";

/**
 * Corrida completa contra D1 real: tienda → normalización → oferta → historial de precios. El vínculo a producto ya
 * no ocurre aquí (#156): la oferta queda `pending` para `framerate-normalize`.
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
  test("primera corrida crea ofertas pendientes y un punto de precio por oferta, sin productos", async () => {
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
    expect(result.stats).toMatchObject({ seen: 3, valid: 2, quarantined: 1, created: 2, enqueued: 2 });
    expect(await all(deps.db, "products")).toHaveLength(0);
    expect(await all(deps.db, "price_points")).toHaveLength(2);
    expect(deps.sent.map((m) => m.reason)).toEqual(["new", "new"]);
    const [q] = await all(deps.db, "quarantine");
    expect(q?.reason).toBe("category:other_product");
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
    expect(await all(deps.db, "price_points")).toHaveLength(4);
    const gone = await all(deps.db, "listings").then((r) => r.find((l) => l.external_id === "3"));
    expect(gone?.is_active).toBe(0);
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
    const active = await all(deps.db, "listings").then((r) => r.filter((l) => l.is_active === 1));
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

describe("cuarentena", () => {
  test("se purga lo de más de 14 días; un rechazo que persiste vuelve a registrarse en la siguiente corrida", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const tienda = fakeStore("alfa", { gpu: ["gpu"] });
    tienda.setOffers([offer("alfa", "1", { category: "gpu", title: "Soporte anti-sag para GPU", priceCash: 15_000 })]);
    await crawlCategory(deps, tienda.store, "gpu");
    clock.advance(15 * 86_400_000);
    // Mismo rechazo, mismo hash: no se repite la fila.
    await crawlCategory(deps, tienda.store, "gpu");

    expect(await purgeQuarantine(deps.db, clock())).toBe(1);
    expect(await all(deps.db, "quarantine")).toHaveLength(0);
    await crawlCategory(deps, tienda.store, "gpu");
    expect(await all(deps.db, "quarantine")).toHaveLength(1);
  });
});

describe("corridas sin cierre", () => {
  test("el Cron marca failed las running pasado el umbral; no toca las recientes ni las cerradas", async () => {
    const deps = testDeps(d1, steppingClock());
    const now = new Date("2026-10-17T06:17:00.000Z");
    const { id: storeId } = await ensureStore(
      deps.db,
      { slug: "alfa", name: "Alfa", url: "https://alfa.example" },
      now.toISOString(),
    );
    await startRun(deps.db, { id: "vieja", storeId, category: "gpu", now: "2026-10-17T00:19:00.000Z" });
    await startRun(deps.db, { id: "reciente", storeId, category: "cpu", now: "2026-10-17T06:10:00.000Z" });

    expect(await closeStuckRuns(deps.db, now)).toBe(1);
    const runs = Object.fromEntries((await all(deps.db, "crawl_runs")).map((r) => [r.id, r]));
    expect(runs.vieja).toMatchObject({ status: "failed", finished_at: now.toISOString() });
    expect(runs.reciente).toMatchObject({ status: "running", finished_at: null });
    expect(await closeStuckRuns(deps.db, now)).toBe(0);
  });
});

describe("datos de origen para la huella", () => {
  test("la oferta conserva el título crudo y todas las fotos", async () => {
    const deps = testDeps(d1, steppingClock());
    const tienda = fakeStore("alfa", { gpu: ["gpu"] });
    const raw = "Nvidia RTX 3050 | MSI Ventus 2X | 6GB GDDR6";
    const images = ["https://alfa.example/1.jpg", "https://alfa.example/2.jpg"];
    tienda.setOffers([offer("alfa", "1", { category: "gpu", title: raw, priceCash: 250_000, imageUrls: images })]);
    await crawlCategory(deps, tienda.store, "gpu");

    const [listing] = await all(deps.db, "listings");
    expect(listing).toMatchObject({ title: "Nvidia RTX 3050 MSI Ventus 2X 6GB GDDR6", raw_title: raw });
    expect(listing?.image_url).toBe(images[0]);
    expect(JSON.parse(listing?.image_urls ?? "[]")).toEqual(images);
  });
});

describe("ofertas que nadie ve", () => {
  const HOUR = 3_600_000;
  const gpus = (slug: string, n: number) =>
    Array.from({ length: n }, (_, i) =>
      offer(slug, String(i), { category: "gpu", title: `MSI RTX 40${60 + i} Ventus 2X 8GB`, priceCash: 300_000 + i }),
    );

  test("una tienda que dejó de responder se apaga a las 48 h y vuelve sola con la siguiente corrida", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const caida = fakeStore("caida", { gpu: ["gpu"] });
    const sana = fakeStore("sana", { gpu: ["gpu"] });
    caida.setOffers(gpus("caida", 2));
    sana.setOffers(gpus("sana", 8));
    await crawlCategory(deps, caida.store, "gpu");
    // Vinculadas, como las dejaría `framerate-link`: lo que se apaga tiene que devolver sus productos.
    for (const l of await all(deps.db, "listings")) {
      const at = clock().toISOString();
      const { id } = await deps.db.query
        .insertInto("products")
        .values({ slug: `p-${l.id}`, name: l.title, category: "gpu", created_at: at, updated_at: at })
        .returning("id")
        .executeTakeFirstOrThrow();
      await deps.db.query.updateTable("listings").set({ product_id: id }).where("id", "=", l.id).execute();
    }
    clock.advance(49 * HOUR);
    await crawlCategory(deps, sana.store, "gpu");

    const result = await deactivateStale(deps.db, clock());
    expect(result).toMatchObject({ deactivated: 2, skipped: false });
    expect(result.productIds).toHaveLength(2);
    const active = (await all(deps.db, "listings")).filter((l) => l.is_active === 1);
    expect(active).toHaveLength(8);

    await crawlCategory(deps, caida.store, "gpu");
    expect((await all(deps.db, "listings")).filter((l) => l.is_active === 1)).toHaveLength(10);
  });

  test("si lo viejo pasa del 30 % es una caída nuestra: no apaga nada", async () => {
    const clock = steppingClock();
    const deps = testDeps(d1, clock);
    const tienda = fakeStore("alfa", { gpu: ["gpu"] });
    tienda.setOffers(gpus("alfa", 3));
    await crawlCategory(deps, tienda.store, "gpu");
    clock.advance(49 * HOUR);
    expect(await deactivateStale(deps.db, clock())).toMatchObject({ deactivated: 0, skipped: true });
  });
});
