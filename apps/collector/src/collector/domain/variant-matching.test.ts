import { describe, expect, test } from "bun:test";
import { areVariants, isColorVariant } from "./variant-matching";

describe("isColorVariant", () => {
  test("Gamemax Iceburg: WHITE vs BK (caso reportado)", () => {
    // Palabra completa vs abreviatura, prefijo común sólo 0.80 → la heurística
    // de prefijo nunca lo detectaba. La estrategia de color sí.
    expect(isColorVariant("ICEBURG-240-DIGITAL-WHITE", "ICEBURG-240-DIGITAL-BK")).toBe(true);
  });

  test("color simétrico (WHITE vs BLACK)", () => {
    expect(isColorVariant("NH-D15-WHITE", "NH-D15-BLACK")).toBe(true);
  });

  test("abreviatura vs abreviatura (WHT vs BLK)", () => {
    expect(isColorVariant("AK620-DIGITAL-WHT", "AK620-DIGITAL-BLK")).toBe(true);
  });

  test("RGB/ARGB tratado como acabado", () => {
    expect(isColorVariant("PL-12-ARGB-BK", "PL-12-BK")).toBe(true);
  });

  test("misma base pero distinto tamaño NO es variante de color", () => {
    // 240 vs 360 cambia un token de base, no de color.
    expect(isColorVariant("ICEBURG-240-DIGITAL-WHITE", "ICEBURG-360-DIGITAL-WHITE")).toBe(false);
  });

  test("sin token de color no aplica", () => {
    expect(isColorVariant("B850M-D3HP", "B850M-D3H")).toBe(false);
  });

  test("base demasiado corta (1 token) no agrupa", () => {
    expect(isColorVariant("X-WHITE", "X-BLACK")).toBe(false);
  });

  test("color no debe matchear como substring dentro de un token", () => {
    // "BKND" contiene "BK" pero como parte de un token, no como segmento.
    expect(isColorVariant("MODEL-BKND", "MODEL-XYZ")).toBe(false);
  });
});

describe("areVariants", () => {
  test("MPN idénticos no son variantes entre sí", () => {
    expect(areVariants("ICEBURG-240-DIGITAL-WHITE", "ICEBURG-240-DIGITAL-WHITE")).toBe(false);
  });

  test("delega en estrategia de color (caso reportado)", () => {
    expect(areVariants("ICEBURG-240-DIGITAL-WHITE", "ICEBURG-240-DIGITAL-BK")).toBe(true);
  });

  test("regresión: prefijo común corto (-BLK / -WHT) sigue funcionando", () => {
    expect(areVariants("CORSAIR-H100I-BLK", "CORSAIR-H100I-WHT")).toBe(true);
  });

  test("regresión: variante de capacidad (8GB vs 16GB)", () => {
    expect(areVariants("RAM-DDR5-8GB-3200", "RAM-DDR5-16GB-3200")).toBe(true);
  });

  test("productos distintos de la misma marca no se agrupan", () => {
    expect(areVariants("B550M-K", "H610M-K-V2")).toBe(false);
  });
});
