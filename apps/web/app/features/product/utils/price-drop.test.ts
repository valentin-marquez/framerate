import { describe, expect, test } from "bun:test";
import { priceDrop } from "./price-drop";

describe("priceDrop", () => {
  test("sin precio o sin referencia no hay baja", () => {
    expect(priceDrop(null, 100_000)).toBeNull();
    expect(priceDrop(90_000, null)).toBeNull();
  });

  test("bajo el 3% es ruido", () => {
    expect(priceDrop(98_000, 100_000)).toBeNull();
    expect(priceDrop(110_000, 100_000)).toBeNull();
  });

  test("desde el 3% muestra monto y porcentaje", () => {
    expect(priceDrop(97_000, 100_000)).toEqual({ amount: 3_000, percent: 3 });
    expect(priceDrop(449_990, 499_990)).toEqual({ amount: 50_000, percent: 10 });
  });
});
