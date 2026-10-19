import { describe, expect, test } from "bun:test";
import { type CondenseItem, planCondense } from "@/features/quotes/condense";

/**
 * Condensar la compra: minimiza plata de más + $10.000 por tienda, sin mover un ítem pasado el tope por unidad. Los
 * tests del tope y de las cantidades usan un valor por tienda enorme para aislar esa regla de la del precio.
 */

const TEKMACHINE = 1;
const TECNOMAS = 2;
const NUEVATEC = 3;
const WINPY = 4;
const ANY_PRICE = { storeValue: 1_000_000 };

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
  test("junta donde el aumento vale la pena y deja la pieza que pasa el tope", () => {
    const plan = planCondense([
      item(1, [offer(TEKMACHINE, 199_990), offer(TECNOMAS, 207_900)]),
      item(2, [offer(TECNOMAS, 125_990)]),
      item(3, [offer(NUEVATEC, 560_310), offer(TECNOMAS, 569_980)], 1),
      item(4, [offer(NUEVATEC, 949_990), offer(TECNOMAS, 1_019_008)]),
      item(5, [offer(WINPY, 89_990), offer(TECNOMAS, 94_990)]),
      item(6, [offer(TEKMACHINE, 59_990), offer(TECNOMAS, 64_990)]),
    ]);

    expect(plan.storesBefore).toBe(4);
    expect(plan.storesAfter).toBe(3);
    // La fuente pasa de Winpy a Tecnomas por $5.000 y se evita una tienda. Las dos piezas de Tekmachine no: moverlas
    // cuesta $12.910 de más y una tienda de menos vale $10.000. La tarjeta de video obliga a conservar Nuevatec y la
    // RAM se queda ahí, en su precio más barato.
    expect(plan.extraCash).toBe(5_000);
    expect([2, 5].map((id) => storeOf(plan, id))).toEqual([TECNOMAS, TECNOMAS]);
    expect([1, 6].map((id) => storeOf(plan, id))).toEqual([TEKMACHINE, TEKMACHINE]);
    expect([3, 4].map((id) => storeOf(plan, id))).toEqual([NUEVATEC, NUEVATEC]);
    expect(plan.assignments.find((a) => a.itemId === 4)?.keptByLimit).toBe(true);
    expect(plan.assignments.filter((a) => a.keptByLimit)).toHaveLength(1);
  });

  test("juntar dos piezas por $10.000 más condensa (lo que vale una tienda) y un peso más no", () => {
    const worth = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 110_000)]),
      item(2, [offer(TECNOMAS, 50_000)]),
    ]);
    expect(worth.storesAfter).toBe(1);
    expect(worth.extraCash).toBe(10_000);

    const tooMuch = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 110_001)]),
      item(2, [offer(TECNOMAS, 50_000)]),
    ]);
    expect(tooMuch.storesAfter).toBe(2);
    expect(tooMuch.extraCash).toBe(0);
  });

  test("no condensa si el aumento supera lo que vale ahorrar tiendas: 3 tiendas a 1 por $75.000 no", () => {
    const plan = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(WINPY, 125_000)]),
      item(2, [offer(TECNOMAS, 200_000), offer(WINPY, 225_000)]),
      item(3, [offer(NUEVATEC, 300_000), offer(WINPY, 325_000)]),
    ]);
    expect(plan.storesBefore).toBe(3);
    expect(plan.storesAfter).toBe(3);
    expect(plan.extraCash).toBe(0);
  });

  test("cada tienda que se evita suma su valor: de 3 a 1 se acepta hasta $20.000 de más", () => {
    const trio = (extra: number) => [
      item(1, [offer(TEKMACHINE, 100_000), offer(WINPY, 100_000 + extra)]),
      item(2, [offer(TECNOMAS, 200_000), offer(WINPY, 200_000 + extra)]),
      item(3, [offer(NUEVATEC, 300_000), offer(WINPY, 300_000 + extra)]),
    ];
    // $20.000 en total (7.000 + 7.000 + 6.000): justo lo que valen las dos tiendas que se evitan.
    const worth = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(WINPY, 107_000)]),
      item(2, [offer(TECNOMAS, 200_000), offer(WINPY, 207_000)]),
      item(3, [offer(NUEVATEC, 300_000), offer(WINPY, 306_000)]),
    ]);
    expect(worth.storesAfter).toBe(1);
    expect(worth.extraCash).toBe(20_000);
    // Siete mil por pieza son $21.000: ya no.
    expect(planCondense(trio(7_000)).storesAfter).toBe(3);
  });

  test("junta sólo donde conviene: una tienda se evita y la otra no", () => {
    const plan = planCondense([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 105_000)]),
      item(2, [offer(TECNOMAS, 50_000)]),
      item(3, [offer(NUEVATEC, 80_000), offer(TECNOMAS, 100_000)]),
      item(4, [offer(WINPY, 60_000)]),
    ]);
    expect(plan.storesBefore).toBe(4);
    expect(plan.storesAfter).toBe(3);
    expect(plan.extraCash).toBe(5_000);
    expect(storeOf(plan, 1)).toBe(TECNOMAS);
    expect(storeOf(plan, 3)).toBe(NUEVATEC);
  });

  test("el tope es inclusivo: justo $30.000 más se acepta y un peso más no", () => {
    const at = planCondense(
      [item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 130_000)]), item(2, [offer(TECNOMAS, 50_000)])],
      ANY_PRICE,
    );
    expect(at.storesAfter).toBe(1);
    expect(at.extraCash).toBe(30_000);

    const over = planCondense(
      [item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 130_001)]), item(2, [offer(TECNOMAS, 50_000)])],
      ANY_PRICE,
    );
    expect(over.storesAfter).toBe(2);
    expect(over.extraCash).toBe(0);
  });

  test("el tope es por unidad y el extra suma por la cantidad", () => {
    const plan = planCondense(
      [item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 120_000)], 3), item(2, [offer(TECNOMAS, 50_000)])],
      ANY_PRICE,
    );
    expect(plan.storesAfter).toBe(1);
    expect(plan.extraCash).toBe(60_000);
  });

  test("entre dos combinaciones del mismo tamaño elige la que cuesta menos", () => {
    const plan = planCondense(
      [
        item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 110_000), offer(NUEVATEC, 125_000)]),
        item(2, [offer(WINPY, 50_000), offer(TECNOMAS, 60_000), offer(NUEVATEC, 52_000)]),
      ],
      ANY_PRICE,
    );
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
