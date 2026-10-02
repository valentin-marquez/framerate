import { describe, expect, test } from "bun:test";
import type { Offer, PricePoint } from "@framerate/contracts";
import { periodFromParam, priceVerdict, summarizeHistory } from "./price-history";

const NOW = Date.parse("2026-09-10T15:00:00Z");

const point = (store: string, day: number, priceCash: number, inStock = true): PricePoint => ({
  store,
  storeName: store,
  priceCash,
  priceCard: priceCash,
  inStock,
  observedAt: `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`,
});

const offer = (store: string, priceCash: number, inStock = true) =>
  ({ store: { slug: store, name: store, url: "" }, priceCash, inStock }) as Offer;

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
