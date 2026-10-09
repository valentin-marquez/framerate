import { describe, expect, test } from "bun:test";
import type { IdentityValue, ListingIdentity } from "@framerate/contracts";
import { compare } from "./decide";
import { fingerprintFromIdentity } from "./fingerprint";

const fp = (category: ListingIdentity["category"], brand: string, identity: Record<string, IdentityValue>) =>
  fingerprintFromIdentity({
    identity: { category, brand, name: `${brand} prueba`, mpn: null, confidence: "high", identity },
  });

describe("huella desde la identidad: texto libre estable entre llamadas", () => {
  // Pares medidos en producción (sombra del 08-10): la misma oferta, dos respuestas de Haiku.
  test("gabinete: la variante se suma al modelo y RGB o color no cuentan", () => {
    const pairs: [Record<string, IdentityValue>, Record<string, IdentityValue>][] = [
      [
        { model: "crystal z6m floe", color: "black" },
        { model: "crystal z6m", variant: "floe", color: "black" },
      ],
      [
        { model: "vx310", variant: "argb", color: "black" },
        { model: "vx310 argb", color: "black" },
      ],
      [
        { model: "fv150 rgb", color: "pink" },
        { model: "fv150", color: "pink" },
      ],
    ];
    for (const [a, b] of pairs) expect(compare(fp("case", "Cougar", a), fp("case", "Cougar", b)).vetoes).toEqual([]);
  });

  test("gabinete: un modelo distinto sigue vetando", () => {
    const a = fp("case", "Cougar", { model: "fv150", color: "pink" });
    const b = fp("case", "Cougar", { model: "fv270", color: "pink" });
    expect(compare(a, b).vetoes).toContain("attribute:model");
  });

  test("GPU: OC tiene campo propio y la variante se suma a la línea", () => {
    const a = fp("gpu", "Gigabyte", { chipset: "rx 9050", vram_gb: 8, line: "gaming oc", oc: true });
    const b = fp("gpu", "Gigabyte", { chipset: "rx 9050", vram_gb: 8, line: "gaming", oc: true });
    expect(compare(a, b).vetoes).toEqual([]);
    const c = fp("gpu", "MSI", { chipset: "rtx 5080", vram_gb: 16, line: "gaming trio", oc: true });
    const d = fp("gpu", "MSI", { chipset: "rtx 5080", vram_gb: 16, line: "gaming", variant: "trio", oc: true });
    expect(compare(c, d).vetoes).toEqual([]);
  });

  // #155: pares iguales de producción, Haiku pone "elite" en la línea o en el modelo según la llamada.
  test("placa: las mismas palabras repartidas entre línea y modelo no vetan", () => {
    const base = { chipset: "b650m", formFactor: "matx", wifi: true };
    const a = fp("motherboard", "Gigabyte", { ...base, line: "aorus", model: "b650m elite" });
    const b = fp("motherboard", "Gigabyte", { ...base, line: "aorus elite", model: "b650m" });
    expect(compare(a, b).vetoes).toEqual([]);
    const c = fp("motherboard", "Gigabyte", { ...base, line: "aorus", model: "b650m pro" });
    expect(compare(a, c).vetoes).toContain("attribute:model");
  });

  test("GPU: otra línea sigue vetando", () => {
    const a = fp("gpu", "MSI", { chipset: "rtx 5060", vram_gb: 8, line: "ventus 2x", oc: true });
    const b = fp("gpu", "MSI", { chipset: "rtx 5060", vram_gb: 8, line: "gaming trio", oc: true });
    expect(compare(a, b).vetoes).toContain("attribute:line");
  });
});
