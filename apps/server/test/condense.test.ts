import { describe, expect, test } from "bun:test";
import { type CondenseItem, type CondensePlan, planCondenseOptions } from "@/features/quotes/condense";

/** Comprar en menos tiendas: el plan más barato para cada número de tiendas y la recomendada. */

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
const storeOf = (plan: CondensePlan | undefined, itemId: number) =>
  plan?.picks.find((p) => p.itemId === itemId)?.offer.storeId;
const summary = (options: CondensePlan[]) =>
  options.map((o) => ({
    stores: o.stores,
    available: o.available,
    extraCash: o.extraCash,
    recommended: o.recommended,
  }));

describe("planCondenseOptions", () => {
  test("una opción por número de tiendas, hasta el reparto más barato", () => {
    const result = planCondenseOptions([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 125_000), offer(WINPY, 130_000)]),
      item(2, [offer(TECNOMAS, 200_000), offer(WINPY, 205_000)]),
      item(3, [offer(NUEVATEC, 300_000), offer(WINPY, 310_000)]),
    ]);
    expect(result.itemCount).toBe(3);
    expect(result.minTotalCash).toBe(600_000);
    // 1 tienda: Winpy (+$45.000). 2: Tekmachine y Winpy (+$15.000). 3: el reparto más barato.
    expect(summary(result.options)).toEqual([
      { stores: 1, available: true, extraCash: 45_000, recommended: false },
      { stores: 2, available: true, extraCash: 15_000, recommended: false },
      { stores: 3, available: true, extraCash: 0, recommended: true },
    ]);
    const [one, two] = result.options;
    expect([1, 2, 3].map((id) => storeOf(one, id))).toEqual([WINPY, WINPY, WINPY]);
    expect([1, 2, 3].map((id) => storeOf(two, id))).toEqual([TEKMACHINE, WINPY, WINPY]);
    expect(two?.totalCash).toBe(615_000);
  });

  test("la recomendada es la de menor extra + $10.000 por tienda; a igual puntaje, menos tiendas", () => {
    const options = (extra: number) =>
      planCondenseOptions([
        item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 100_000 + extra)]),
        item(2, [offer(TECNOMAS, 50_000)]),
      ]).options;
    // $10.000 más por evitar una tienda empata con lo que vale: gana la de 1 tienda.
    expect(summary(options(10_000)).map((o) => o.recommended)).toEqual([true, false]);
    expect(summary(options(10_001)).map((o) => o.recommended)).toEqual([false, true]);
  });

  test("sin tienda que tenga todo, la opción de 1 no está disponible y dice por qué", () => {
    const { options } = planCondenseOptions([
      item(1, [offer(TEKMACHINE, 100_000)]),
      item(2, [offer(TECNOMAS, 50_000), offer(NUEVATEC, 55_000)]),
    ]);
    expect(options[0]).toMatchObject({
      stores: 1,
      available: false,
      unavailableReason: "Ninguna tienda tiene los 2 componentes",
      picks: [],
    });
    expect(options[1]).toMatchObject({ stores: 2, available: true, extraCash: 0, recommended: true });
  });

  test("el extra y el total suman por la cantidad", () => {
    const { options, minTotalCash } = planCondenseOptions([
      item(1, [offer(TEKMACHINE, 100_000), offer(TECNOMAS, 120_000)], 3),
      item(2, [offer(TECNOMAS, 50_000)]),
    ]);
    expect(minTotalCash).toBe(350_000);
    expect(options[0]).toMatchObject({ stores: 1, totalCash: 410_000, extraCash: 60_000 });
  });

  test("si el mejor de k usa menos tiendas, no se repite como opción", () => {
    // Con 2 tiendas lo mejor sigue siendo todo en Tecnomas: no hay opción de 2.
    const { options } = planCondenseOptions([
      item(1, [offer(TECNOMAS, 100_000), offer(TEKMACHINE, 120_000)]),
      item(2, [offer(TECNOMAS, 50_000), offer(NUEVATEC, 60_000)]),
    ]);
    expect(summary(options)).toEqual([{ stores: 1, available: true, extraCash: 0, recommended: true }]);
  });

  test("a igual precio prefiere una tienda que ya está en el plan, y luego el menor listingId", () => {
    const tekCpu = offer(TEKMACHINE, 100_000);
    const tecCpu = offer(TECNOMAS, 100_000);
    const { options } = planCondenseOptions([item(1, [tecCpu, tekCpu]), item(2, [offer(TEKMACHINE, 50_000)])]);
    // El ítem 1 cuesta lo mismo en las dos; queda en Tekmachine porque el ítem 2 sólo está ahí.
    expect(summary(options)).toEqual([{ stores: 1, available: true, extraCash: 0, recommended: true }]);
    expect(storeOf(options[0], 1)).toBe(TEKMACHINE);

    const first = offer(TECNOMAS, 80_000);
    const second = offer(TECNOMAS, 80_000);
    const same = planCondenseOptions([item(1, [second, first])]);
    expect(same.options[0]?.picks[0]?.offer.listingId).toBe(first.listingId);
  });

  test("ignora los ítems sin oferta; sin ítems no hay opciones", () => {
    const { itemCount, options } = planCondenseOptions([item(1, [offer(TECNOMAS, 90_000)]), item(2, [])]);
    expect(itemCount).toBe(1);
    expect(options).toHaveLength(1);
    expect(planCondenseOptions([])).toEqual({ itemCount: 0, minTotalCash: 0, options: [] });
  });

  test("con 20 tiendas quedan 12, entre ellas las más baratas de cada ítem, y llega al mínimo", () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      item(i + 1, [offer(100 + i, 10_000), ...Array.from({ length: 15 }, (_, s) => offer(200 + s, 11_000 + s))]),
    );
    const { options, minTotalCash } = planCondenseOptions(many);
    expect(options.at(-1)?.totalCash).toBe(minTotalCash);
    expect(options[0]).toMatchObject({ stores: 1, extraCash: 5_000 });
  });
});
