import { describe, expect, test } from "bun:test";
import {
  identifiersConflict,
  identifierType,
  keywordInName,
  numbersConflict,
  significantNumbers,
  stripMatchingNoise,
} from "../catalog.service";

// Fase 1 del fix de dedup: helpers del matcher de productos entre tiendas.
// Caso motivador: dust2 publica EAN en `sku`; pc-express/sp-digital publican MPN.

describe("identifierType", () => {
  test("códigos de 12-14 dígitos puros son EAN/UPC/GTIN", () => {
    expect(identifierType("5032037279192")).toBe("ean"); // EAN-13 Intel
    expect(identifierType("730143318327")).toBe("ean"); // UPC-12 AMD
  });

  test("códigos alfanuméricos son MPN", () => {
    expect(identifierType("BX8071514900F")).toBe("mpn");
    expect(identifierType("100-100000718BOX")).toBe("mpn");
    expect(identifierType("0306007A07N")).toBe("mpn");
  });

  test("vacío/ausente es null", () => {
    expect(identifierType("")).toBeNull();
    expect(identifierType(null)).toBeNull();
    expect(identifierType(undefined)).toBeNull();
  });
});

describe("identifiersConflict", () => {
  test("EAN vs MPN NO es conflicto — son clases distintas", () => {
    // El núcleo del fix: el EAN de dust2 no debe bloquear el match por título.
    expect(identifiersConflict("5032037279192", "BX8071514900F")).toBe(false);
  });

  test("dos MPN distintos SÍ son conflicto", () => {
    expect(identifiersConflict("B850 GAMING PLUS", "B860 TOMAHAWK")).toBe(true);
  });

  test("el mismo MPN escrito distinto NO es conflicto", () => {
    expect(identifiersConflict("B850M D3HP", "B850M-D3HP")).toBe(false);
  });

  test("dos EAN distintos SÍ son conflicto", () => {
    expect(identifiersConflict("5032037279192", "5032037281928")).toBe(true);
  });

  test("si falta uno, no hay conflicto", () => {
    expect(identifiersConflict(null, "BX8071514900F")).toBe(false);
    expect(identifiersConflict("BX8071514900F", "")).toBe(false);
  });
});

describe("stripMatchingNoise", () => {
  test("saca sustantivo de categoría, frase de marketing y socket", () => {
    const out = stripMatchingNoise("Procesador Intel Core i9-14900, hasta 5.8Ghz, LGA1700");
    expect(out).not.toContain("Procesador");
    expect(out).not.toContain("hasta");
    expect(out).not.toContain("LGA1700");
    expect(out).toContain("Intel Core i9-14900");
  });

  test("conserva marca, número de modelo y capacidad", () => {
    const out = stripMatchingNoise("Memoria RAM Kingston Fury Beast 16GB DDR4 3200MHz");
    expect(out).not.toContain("Memoria");
    expect(out).toContain("Kingston");
    expect(out).toContain("16GB");
    expect(out).toContain("3200MHz");
  });
});

describe("keywordInName", () => {
  test("no matchea un sufijo de variante: 14900 ≠ 14900K ≠ 14900F", () => {
    expect(keywordInName("14900", "INTEL CORE I9-14900K")).toBe(false);
    expect(keywordInName("14900", "INTEL CORE I9-14900F 24C/32T")).toBe(false);
  });

  test("matchea el token exacto", () => {
    expect(keywordInName("14900", "INTEL CORE I9-14900, 5.8GHZ")).toBe(true);
    expect(keywordInName("14600KF", "INTEL CORE I5-14600KF 14C/20T")).toBe(true);
  });

  test("matchea un modelo pegado a un prefijo: 5070 dentro de RTX5070", () => {
    expect(keywordInName("5070", "ASUS DUAL RTX5070 OC")).toBe(true);
  });

  test("no matchea 5070 dentro de 5070TI (otra GPU)", () => {
    expect(keywordInName("5070", "RTX5070TI GAMING OC")).toBe(false);
  });
});

describe("significantNumbers", () => {
  test("extrae secuencias de 3+ dígitos, ignora el MPN entre corchetes", () => {
    const nums = significantNumbers("Kingston Fury 16GB DDR5 6000 MT/s [KF560C40-16]");
    expect(nums.has("6000")).toBe(true);
    expect(nums.has("16")).toBe(false); // capacidad de 2 dígitos: la cubren los keywords
    expect(nums.has("560")).toBe(false); // dentro del MPN, ignorado
  });
});

describe("numbersConflict", () => {
  test("RAM DDR5 6000 vs DDR5 4800 → conflicto (variantes distintas)", () => {
    expect(numbersConflict(significantNumbers("DDR5 6000"), significantNumbers("DDR5 4800"))).toBe(true);
  });

  test("título verbose vs terse con los mismos números → sin conflicto", () => {
    expect(
      numbersConflict(
        significantNumbers("Intel Core i9-14600KF hasta 5300 MHz"),
        significantNumbers("Intel Core i9-14600KF"),
      ),
    ).toBe(false); // {14600,5300} ⊃ {14600} — subconjunto, OK
  });

  test("un lado sin números discriminantes → sin conflicto", () => {
    expect(numbersConflict(significantNumbers("Corsair RM850x"), significantNumbers("Corsair PSU"))).toBe(false);
  });
});
