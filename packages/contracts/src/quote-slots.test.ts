import { describe, expect, test } from "bun:test";
import { psuSizing } from "./quote-slots";

describe("psuSizing", () => {
  test("463 W: mínima de 650 W y recomendada de 750 W", () => {
    expect(psuSizing(463)).toEqual({ minimum: 650, recommended: 750 });
  });

  test("termina siempre en una potencia que se vende", () => {
    expect(psuSizing(343)).toEqual({ minimum: 450, recommended: 550 });
    expect(psuSizing(200)).toEqual({ minimum: 450, recommended: 500 });
    expect(psuSizing(700)).toEqual({ minimum: 1000, recommended: 1200 });
  });

  test("la recomendada nunca es menor que la mínima, y sube un escalón si el cálculo cae igual", () => {
    for (let watts = 100; watts <= 1400; watts += 7) {
      const { minimum, recommended } = psuSizing(watts);
      expect(recommended).toBeGreaterThanOrEqual(minimum);
    }
    expect(psuSizing(330).recommended).toBeGreaterThan(psuSizing(330).minimum);
  });

  test("por encima de la mayor fuente de la lista redondea a la centena", () => {
    expect(psuSizing(1500)).toEqual({ minimum: 2000, recommended: 2400 });
  });
});
