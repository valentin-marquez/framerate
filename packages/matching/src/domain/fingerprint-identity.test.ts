import { describe, expect, test } from "bun:test";
import type { IdentityValue, ListingIdentity } from "@framerate/contracts";
import { compare, decide } from "./decide";
import { fingerprintFromIdentity } from "./fingerprint";

const fp = (category: ListingIdentity["category"], brand: string, identity: Record<string, IdentityValue>) =>
  fingerprintFromIdentity({
    identity: { category, brand, name: `${brand} prueba`, mpn: null, confidence: "high", identity },
  });
// Vetos y texto libre distinto juntos: lo que separa a dos ofertas, veten o sólo impidan el vínculo automático.
const differences = (a: ReturnType<typeof fp>, b: ReturnType<typeof fp>) => {
  const { vetoes, evidence } = compare(a, b);
  return [...vetoes, ...(evidence.textMismatch ?? []).map((f) => `text:${f}`)];
};

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
    for (const [a, b] of pairs) expect(differences(fp("case", "Cougar", a), fp("case", "Cougar", b))).toEqual([]);
  });

  test("gabinete: un modelo distinto sigue vetando", () => {
    const a = fp("case", "Cougar", { model: "fv150", color: "pink" });
    const b = fp("case", "Cougar", { model: "fv270", color: "pink" });
    expect(differences(a, b)).toContain("text:model");
  });

  test("GPU: OC tiene campo propio y la variante se suma a la línea", () => {
    const a = fp("gpu", "Gigabyte", { chipset: "rx 9050", vram_gb: 8, line: "gaming oc", oc: true });
    const b = fp("gpu", "Gigabyte", { chipset: "rx 9050", vram_gb: 8, line: "gaming", oc: true });
    expect(differences(a, b)).toEqual([]);
    const c = fp("gpu", "MSI", { chipset: "rtx 5080", vram_gb: 16, line: "gaming trio", oc: true });
    const d = fp("gpu", "MSI", { chipset: "rtx 5080", vram_gb: 16, line: "gaming", variant: "trio", oc: true });
    expect(differences(c, d)).toEqual([]);
  });

  // #155: pares iguales de producción, Haiku pone "elite" en la línea o en el modelo según la llamada.
  test("placa: las mismas palabras repartidas entre línea y modelo no vetan", () => {
    const base = { chipset: "b650m", formFactor: "matx", wifi: true };
    const a = fp("motherboard", "Gigabyte", { ...base, line: "aorus", model: "b650m elite" });
    const b = fp("motherboard", "Gigabyte", { ...base, line: "aorus elite", model: "b650m" });
    expect(differences(a, b)).toEqual([]);
    const c = fp("motherboard", "Gigabyte", { ...base, line: "aorus", model: "b650m pro" });
    expect(differences(a, c)).toContain("attribute:model");
  });

  // Desvinculados en el ciclo de las 00:17 UTC del 10-10: la ASUS TUF 5060 Ti y las Core Nex Digital de Wei.
  test('"gaming" y la abreviatura ML no distinguen la línea ni el modelo', () => {
    const gpu = { chipset: "rtx 5060 ti", vram_gb: 16, oc: true };
    const a = fp("gpu", "ASUS", { ...gpu, line: "tuf gaming" });
    expect(differences(a, fp("gpu", "ASUS", { ...gpu, line: "tuf" }))).toEqual([]);
    expect(differences(a, fp("gpu", "ASUS", { ...gpu, line: "prime" }))).toContain("text:line");
    const msi = { chipset: "rtx 5060", vram_gb: 8, oc: true };
    const gaming = fp("gpu", "MSI", { ...msi, line: "gaming" });
    expect(differences(gaming, fp("gpu", "MSI", { ...msi, line: "gaming x" }))).toContain("text:line");
    expect(differences(gaming, fp("gpu", "MSI", { ...msi, line: "ventus 2x" }))).toContain("text:line");
    const aio = { type: "aio", radiator_mm: 240, color: "black", rgb: true };
    const ml = fp("cpu_cooler", "Cooler Master", { ...aio, model: "ml core nex digital 240" });
    const full = fp("cpu_cooler", "Cooler Master", { ...aio, model: "masterliquid core nex digital 240" });
    expect(differences(ml, full)).toEqual([]);
    const other = fp("cpu_cooler", "Cooler Master", { ...aio, model: "masterliquid core nex 240" });
    expect(differences(ml, other)).toContain("text:model");
  });

  test("SSD: la serie repartida entre línea y serie no veta, otra serie sí", () => {
    const base = { capacity: 500, interface: "nvme", formFactor: "2280", pcieGen: 3 };
    const a = fp("ssd", "ADATA", { ...base, line: "legend 710" });
    expect(differences(a, fp("ssd", "ADATA", { ...base, line: "legend", series: "710" }))).toEqual([]);
    expect(differences(a, fp("ssd", "ADATA", { ...base, line: "legend", series: "800" }))).not.toEqual([]);
  });

  test("GPU: otra línea los separa", () => {
    const a = fp("gpu", "MSI", { chipset: "rtx 5060", vram_gb: 8, line: "ventus 2x", oc: true });
    const b = fp("gpu", "MSI", { chipset: "rtx 5060", vram_gb: 8, line: "gaming trio", oc: true });
    expect(differences(a, b)).toContain("text:line");
  });

  test("texto libre distinto no veta, pero no vincula solo aunque la clave coincida", () => {
    const base = { capacity_gb: 1000, interface: "nvme", form_factor: "m2_2280", pcie_gen: 4 };
    const nv3 = fp("ssd", "Kingston", { ...base, line: "nv3" });
    const kc3000 = fp("ssd", "Kingston", { ...base, line: "kc3000" });
    expect(compare(nv3, kc3000).vetoes).toEqual([]);
    expect(decide(nv3, [{ productId: 1, fingerprint: kc3000, sameStore: false }]).kind).not.toBe("link");
    // Con el mismo MPN sí: el identificador manda sobre el texto.
    const withMpn = (f: typeof nv3) => ({ ...f, mpn: "SNV3S1000G" });
    expect(decide(withMpn(nv3), [{ productId: 1, fingerprint: withMpn(kc3000), sameStore: false }]).kind).toBe("link");
  });

  test("un MPN que es el nombre pegado no cuenta; uno real sí", () => {
    const identity = (mpn: string) =>
      fingerprintFromIdentity({
        identity: {
          category: "cpu_cooler",
          brand: "MSI",
          name: "MSI MAG CoreLiquid A15 240 ARGB",
          mpn: null,
          confidence: "high",
          identity: { model: "mag coreliquid a15 240" },
        },
        mpn,
      });
    expect(identity("MSIMAGCORELIQUIDA15240").mpn).toBeNull();
    expect(identity("306-7ZWAA11-L80").mpn).toBe("3067ZWAA11L80");
  });
});
