import { describe, expect, test } from "bun:test";
import { psuSizing } from "./quote-slots";

describe("psuSizing", () => {
  test("463 W: mínima de 700 W y recomendada de 850 W", () => {
    expect(psuSizing(463)).toEqual({ minimum: 700, recommended: 850 });
  });

  test("termina siempre en una potencia que se vende", () => {
    expect(psuSizing(343)).toEqual({ minimum: 550, recommended: 650 });
    expect(psuSizing(200)).toEqual({ minimum: 450, recommended: 500 });
    expect(psuSizing(700)).toEqual({ minimum: 1200, recommended: 1300 });
  });

  test("la recomendada nunca es menor que la mínima, y sube un escalón si el cálculo cae igual", () => {
    for (let watts = 100; watts <= 1400; watts += 7) {
      const { minimum, recommended } = psuSizing(watts);
      expect(recommended).toBeGreaterThanOrEqual(minimum);
    }
    expect(psuSizing(200).recommended).toBeGreaterThan(psuSizing(200).minimum);
  });

  test("por encima de la mayor fuente de la lista redondea a la centena", () => {
    expect(psuSizing(1500)).toEqual({ minimum: 2300, recommended: 2700 });
  });
});
