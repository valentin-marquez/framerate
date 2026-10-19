import { describe, expect, test } from "bun:test";
import { type CondenseItem, planCondense } from "@/features/quotes/condense";

/** Condensar la compra: menos tiendas sin pasar el tope por unidad, y entre iguales, la más barata. */

const TEKMACHINE = 1;
const TECNOMAS = 2;
const NUEVATEC = 3;
const WINPY = 4;

let listing = 0;
const offer = (storeId: number, priceCash: number) => ({ listingId: ++listing, storeId, priceCash });
const item = (itemId: number, offers: ReturnType<typeof offer>[], quantity = 1): CondenseItem => ({
  itemId,
  quantity,
  offers,
});
const storeOf = (plan: ReturnType<typeof planCondense>, itemId: number) =>
  plan.assignments.find((a) => a.itemId === itemId)?.offer.storeId;

describe("planCondense", () => {
  test("pasa de 4 tiendas a 2 por lo que cuesta de más y deja la pieza que pasa el tope", () => {
    const plan = planCondense([
      item(1, [offer(TEKMACHINE, 199_990), offer(TECNOMAS, 207_900)]),
      item(2, [offer(TECNOMAS, 125_990)]),
      item(3, [offer(NUEVATEC, 560_310), offer(TECNOMAS, 569_980)], 1),
      item(4, [offer(NUEVATEC, 949_990), offer(TECNOMAS, 1_019_008)]),
      item(5, [offer(WINPY, 89_990), offer(TECNOMAS, 94_990)]),
      item(6, [offer(TEKMACHINE, 59_990), offer(TECNOMAS, 64_990)]),
    ]);

    expect(plan.storesBefore).toBe(4);
    expect(plan.storesAfter).toBe(2);
    // La tarjeta de video obliga a conservar Nuevatec, así que la RAM se queda ahí, en su precio más barato.
    expect(plan.extraCash).toBe(7_910 + 5_000 + 5_000);
    expect([1, 2, 5, 6].map((id) => storeOf(plan, id))).toEqual([TECNOMAS, TECNOMAS, TECNOMAS, TECNOMAS]);
    expect([3, 4].map((id) => storeOf(plan, id))).toEqual([NUEVATEC, NUEVATEC]);
    expect(plan.assignments.find((a) => a.itemId === 4)?.keptByLimit).toBe(true);
    expect(plan.assignments.filter((a) => a.keptByLimit)).toHaveLength(1);
  });

  test("el tope es inclusivo: justo $30.000 más se acepta y un peso más no", () => {
    const at = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 130_000)]),
      item(2, [offer(TECNOMAS, 50_000)]),
    ]);
    expect(at.storesAfter).toBe(1);
    expect(at.extraCash).toBe(30_000);

    const over = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 130_001)]),
      item(2, [offer(TECNOMAS, 50_000)]),
    ]);
    expect(over.storesAfter).toBe(2);
    expect(over.extraCash).toBe(0);
  });

  test("el tope es por unidad y el extra suma por la cantidad", () => {
    const plan = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 120_000)], 3),
      item(2, [offer(TECNOMAS, 50_000)]),
    ]);
    expect(plan.storesAfter).toBe(1);
    expect(plan.extraCash).toBe(60_000);
  });

  test("entre dos combinaciones del mismo tamaño elige la que cuesta menos", () => {
    const plan = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 110_000), offer(NUEVATEC, 125_000)]),
      item(2, [offer(WINPY, 50_000), offer(TECNOMAS, 60_000), offer(NUEVATEC, 52_000)]),
    ]);
    expect(plan.storesAfter).toBe(1);
    expect(plan.extraCash).toBe(20_000);
    expect(storeOf(plan, 1)).toBe(TECNOMAS);
  });

  test("si no se puede usar menos tiendas, deja cada ítem en la más barata y no cobra de más", () => {
    const plan = planCondense([item(1, [offer(TEKMACHINE, 100_000)]), item(2, [offer(TECNOMAS, 50_000)])]);
    expect(plan.storesBefore).toBe(2);
    expect(plan.storesAfter).toBe(2);
    expect(plan.extraCash).toBe(0);
    expect(plan.assignments.map((a) => a.offer.listingId)).toEqual(plan.assignments.map((a) => a.cheapest.listingId));
  });

  test("ignora los ítems sin oferta y se queda con la oferta más barata de cada tienda", () => {
    const cheap = offer(TECNOMAS, 90_000);
    const plan = planCondense([item(1, [offer(TECNOMAS, 95_000), cheap]), item(2, [])]);
    expect(plan.assignments).toHaveLength(1);
    expect(plan.assignments[0]?.offer.listingId).toBe(cheap.listingId);
    expect(plan.storesBefore).toBe(1);
  });

  test("sin ítems no hay nada que condensar", () => {
    expect(planCondense([])).toEqual({ assignments: [], storesBefore: 0, storesAfter: 0, extraCash: 0 });
  });
});
