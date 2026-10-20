import { describe, expect, test } from "bun:test";
import type { Offer, PricePoint } from "@framerate/contracts";
import { bestOf, historyDays, niceTicks, periodFromParam, priceVerdict, summarizeHistory } from "./price-history";

const NOW = Date.parse("2026-09-10T15:00:00Z");

// Una publicación por tienda salvo que el test diga otra cosa.
const point = (
  store: string,
  day: number,
  priceCash: number,
  inStock = true,
  listingId = store.charCodeAt(0),
): PricePoint => ({
  listingId,
  store,
  storeName: store,
  priceCash,
  priceCard: priceCash,
  inStock,
  observedAt: `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`,
});

const offer = (store: string, priceCash: number, inStock = true, id = store.charCodeAt(0)) =>
  ({ id, store: { slug: store, name: store, url: "" }, priceCash, inStock }) as Offer;

describe("summarizeHistory", () => {
  test("con menos de 7 días desde el primer dato no hay resumen", () => {
    expect(summarizeHistory([point("a", 5, 100)], [offer("a", 100)], 30, NOW)).toBeNull();
  });

  test("cada tienda arrastra su último precio y las sin stock no cuentan", () => {
    const points = [point("a", 1, 500), point("b", 1, 400), point("b", 3, 350, false), point("a", 8, 420)];
    // Días 1-2: b a 400. Días 3-7: sólo a, a 500. Días 8-10: a a 420.
    expect(summarizeHistory(points, [offer("a", 420), offer("b", 350, false)], 30, NOW)).toEqual({
      min: 400,
      max: 500,
      usual: 500,
      since: "2026-09-01",
      coversPeriod: false,
    });
  });

  test("una tienda que no cambió en el período tuvo su precio actual todo el tiempo", () => {
    const summary = summarizeHistory([point("a", 9, 300)], [offer("a", 300), offer("b", 450)], 30, NOW);
    expect(summary).toMatchObject({ min: 300, max: 450, usual: 450, coversPeriod: true });
  });
});

test("priceVerdict compara con el mínimo y el habitual", () => {
  const h = { min: 420, max: 500, usual: 450, since: "2026-09-01", coversPeriod: true };
  expect(priceVerdict(420, h).tone).toBe("good");
  expect(priceVerdict(455, h).tone).toBe("neutral");
  expect(priceVerdict(480, h).tone).toBe("bad");
});

test("periodFromParam cae en el último mes si el valor no es uno de los períodos", () => {
  expect(periodFromParam("6m").days).toBe(180);
  expect(periodFromParam("99m").days).toBe(30);
  expect(periodFromParam(null).days).toBe(30);
});

describe("historyDays y bestOf", () => {
  test("el mejor precio de cada día sale de la tienda con stock más barata, y llega hasta hoy", () => {
    const points = [point("a", 7, 500), point("b", 7, 450), point("b", 9, 450, false)];
    const ds = historyDays(points, [offer("a", 500), offer("b", 450, false)], 30, NOW);
    expect(ds.map((d) => d.day)).toEqual(["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"]);
    expect(ds.map((d) => bestOf(d, "cash")?.store)).toEqual(["b", "b", "a", "a"]);
  });

  test("una tienda con dos publicaciones: el punto de una no tapa la oferta actual de la otra", () => {
    // n publica dos veces: la 1 (con stock, sin cambios) y la 2 (se agotó el día 8). w cambió el día 9.
    const points = [point("n", 8, 540, false, 2), point("w", 9, 675)];
    const ds = historyDays(points, [offer("n", 638, true, 1), offer("n", 540, false, 2), offer("w", 675)], 30, NOW);
    expect(bestOf(ds.at(-1)!, "cash")).toMatchObject({ store: "n", cash: 638 });
    expect(ds.at(-1)?.stores.filter((s) => s.store === "n")).toHaveLength(1);
  });
});

describe("niceTicks", () => {
  test("marcas redondas que cubren el rango", () => {
    expect(niceTicks(514_299, 738_591)).toEqual([500_000, 550_000, 600_000, 650_000, 700_000, 750_000]);
    expect(niceTicks(100, 100).length).toBeGreaterThan(1);
    // Un rango angosto (precio casi plano) no se llena de marcas.
    expect(niceTicks(525_000, 570_000).length).toBeLessThanOrEqual(6);
  });
});
