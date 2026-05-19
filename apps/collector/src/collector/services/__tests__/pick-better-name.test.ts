import { describe, expect, test } from "bun:test";
import { looksCorrupted, pickBetterName } from "../catalog.service";

describe("looksCorrupted", () => {
  test("paréntesis vacíos", () => {
    expect(looksCorrupted("Gamemax () GP-850 No 850W 80+ Bronze ATX")).toBe(true);
  });
  test("paréntesis desbalanceado / suelto", () => {
    expect(looksCorrupted("MSI Pack 6 Unidades MAG A650BN III No ) 650W 80+ Bronze ATX")).toBe(true);
  });
  test("run de guiones vacíos", () => {
    expect(looksCorrupted("Intel Cpu - Xpg Levante Ii - - - 240 240mm AIO ARGB Black")).toBe(true);
  });
  test("artefacto de categoría manglada 'Cpu - '", () => {
    expect(looksCorrupted("Intel Cpu - Xpg Levante Ii - B Nco - 240mm AIO ARGB White")).toBe(true);
  });
  test("nombre limpio no es corrupto", () => {
    expect(looksCorrupted("XPG Levante II 240mm AIO ARGB Black")).toBe(false);
    expect(looksCorrupted("Gamemax GP-850 850W 80+ Bronze ATX")).toBe(false);
    expect(looksCorrupted("Corsair RM750e 750W 80+ Gold Modular")).toBe(false);
  });
});

describe("pickBetterName — override por corrupción", () => {
  test("renombra roto → limpio sin importar GB/MPN", () => {
    const r = pickBetterName({
      existingName: "Intel Cpu - Xpg Levante Ii - - - 240 240mm AIO ARGB Black",
      newName: "XPG Levante II 240mm AIO ARGB Black",
      mpn: "LEVANTEII240-BKCWW",
    });
    expect(r.renamed).toBe(true);
    expect(r.reason).toBe("corruption_override");
    expect(r.name).toBe("XPG Levante II 240mm AIO ARGB Black");
  });

  test("no oscila: si lo nuevo también está roto, no renombra a otro roto", () => {
    const r = pickBetterName({
      existingName: "Gamemax () GP-850 No 850W 80+ Bronze ATX",
      newName: "Gamemax () GP-850 No 850W 80+ Bronze ATX (Ensambladores) )",
      mpn: "GP-850",
    });
    expect(r.renamed).toBe(false);
  });

  test("una vez limpio, deja de aplicar (estable)", () => {
    const r = pickBetterName({
      existingName: "XPG Levante II 240mm AIO ARGB Black",
      newName: "XPG Levante II 240mm AIO ARGB Black",
      mpn: "LEVANTEII240-BKCWW",
    });
    expect(r.renamed).toBe(false);
  });

  test("no toca caso GB/MPN normal (no regresión)", () => {
    // Sin corrupción → cae en la lógica conservadora previa (mismo GB → no-op).
    const r = pickBetterName({
      existingName: "ASUS Dual RTX 5060 8GB",
      newName: "ASUS Dual RTX 5060 8GB OC",
      mpn: "DUAL-RTX5060-O8G",
    });
    expect(r.renamed).toBe(false);
    expect(r.reason).toBe("same_gb_or_no_gb");
  });
});
