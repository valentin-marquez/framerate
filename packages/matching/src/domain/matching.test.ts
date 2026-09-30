import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import { PROFILES } from "./attributes";
import { canonicalBrand, detectBrand } from "./brands";
import { type Candidate, compare, decide } from "./decide";
import { buildFingerprint } from "./fingerprint";
import { normalizeGtin, normalizeMpn } from "./identifiers";

const fp = (category: Category, title: string, extra: { mpn?: string; gtin?: string; brand?: string } = {}) =>
  buildFingerprint({ category, title, ...extra });

describe("identificadores", () => {
  test("normaliza variantes del mismo MPN", () => {
    expect(normalizeMpn("DUAL-RTX4070S-O12G")).toBe("DUALRTX4070SO12G");
    expect(normalizeMpn(" dual rtx4070s o12g ")).toBe("DUALRTX4070SO12G");
    expect(normalizeMpn("100-100000910WOF")).toBe("100100000910WOF");
  });

  test("descarta MPN basura o ids internos", () => {
    for (const junk of ["N/A", "sin sku", "12345", "PROCESADOR", "", null, undefined, "ab1"]) {
      expect(normalizeMpn(junk)).toBeNull();
    }
  });

  test("GTIN válido se normaliza a 14 dígitos; checksum inválido se descarta", () => {
    expect(normalizeGtin("4006381333931")).toBe("04006381333931");
    expect(normalizeGtin("4006381333932")).toBeNull();
    expect(normalizeGtin("0000000000000")).toBeNull();
    expect(normalizeGtin("12345")).toBeNull();
  });
});

describe("marcas", () => {
  test("ensamblador gana sobre fabricante del chip", () => {
    expect(detectBrand("Tarjeta de Video ASUS Dual GeForce RTX 4070 SUPER 12GB")).toBe("ASUS");
    expect(detectBrand("Tarjeta de video Sapphire Pulse AMD Radeon RX 7800 XT 16GB")).toBe("Sapphire");
    expect(detectBrand("Procesador AMD Ryzen 7 7800X3D")).toBe("AMD");
  });

  test("alias largos antes que cortos y sin falsos positivos dentro de palabras", () => {
    expect(detectBrand("Disco Western Digital Blue 1TB")).toBe("Western Digital");
    expect(detectBrand("SSD WD Black SN850X 2TB")).toBe("Western Digital");
    expect(detectBrand("Memoria G.Skill Trident Z5 32GB")).toBe("G.Skill");
    expect(detectBrand("Gabinete genérico sin marca")).toBeNull();
    expect(canonicalBrand("xpg")).toBe("ADATA");
  });
});

describe("atributos por categoría", () => {
  test("GPU", () => {
    expect(PROFILES.gpu.extract("ASUS Dual GeForce RTX 4070 SUPER OC 12GB GDDR6X")).toEqual({
      chipset: "rtx 4070 super",
      vram: 12,
      line: "dual",
      oc: true,
    });
    expect(PROFILES.gpu.extract("Gigabyte Radeon RX 7800 XT Gaming OC 16G").chipset).toBe("rx 7800 xt");
    expect(PROFILES.gpu.extract("Intel Arc B580 Limited Edition 12GB").chipset).toBe("arc b580");
    expect(PROFILES.gpu.extract("MSI RTX 5070 Ti 16GB Ventus 3X").chipset).toBe("rtx 5070 ti");
  });

  test("CPU", () => {
    expect(PROFILES.cpu.extract("Procesador AMD Ryzen 7 7800X3D AM5").model).toBe("ryzen 7 7800x3d");
    expect(PROFILES.cpu.extract("Procesador Intel Core i5-14600K LGA1700").model).toBe("core i5 14600k");
    expect(PROFILES.cpu.extract("Intel Core Ultra 7 265K").model).toBe("core ultra 7 265k");
    expect(PROFILES.cpu.extract("Ryzen 5 5600 vs 5600X").model).toBe("ryzen 5 5600");
  });

  test("RAM: kit vs módulo único", () => {
    expect(PROFILES.ram.extract("Kingston Fury Beast 32GB (2x16GB) DDR5 6000MHz")).toEqual({
      type: "ddr5",
      modules: 2,
      capacity: 32,
      speed: 6000,
      formFactor: "dimm",
    });
    expect(PROFILES.ram.extract("Memoria Notebook SO-DIMM 16GB DDR4 3200 MHz")).toMatchObject({
      modules: 1,
      capacity: 16,
      formFactor: "sodimm",
    });
  });

  test("almacenamiento, PSU y placa madre", () => {
    expect(PROFILES.ssd.extract("SSD Samsung 990 PRO 2TB NVMe M.2")).toEqual({ capacity: 2000, interface: "nvme" });
    expect(PROFILES.hdd.extract('Disco Duro Seagate Barracuda 2TB 7200RPM 3.5"')).toEqual({
      capacity: 2000,
      rpm: 7200,
      formFactor: "3.5",
    });
    expect(PROFILES.psu.extract("Fuente de Poder Corsair RM850e 850W 80 Plus Gold")).toEqual({
      wattage: 850,
      efficiency: "gold",
    });
    expect(PROFILES.motherboard.extract("Placa Madre MSI MAG B650M Mortar WiFi")).toEqual({
      chipset: "b650",
      formFactor: "matx",
      wifi: true,
    });
  });
});

describe("decisión de matching", () => {
  const existing = (id: number, category: Category, title: string, extra = {}): Candidate => ({
    productId: id,
    fingerprint: fp(category, title, extra),
  });

  test("mismo MPN en distinto formato → link por identificador", () => {
    const offer = fp("gpu", "Tarjeta de video ASUS DUAL RTX 4070 Super OC 12GB", { mpn: "DUAL-RTX4070S-O12G" });
    const decision = decide(offer, [
      existing(1, "gpu", "ASUS Dual GeForce RTX 4070 SUPER OC Edition 12GB GDDR6X", { mpn: "dual rtx4070s o12g" }),
    ]);
    expect(decision).toMatchObject({ kind: "link", productId: 1, method: "identifier" });
  });

  test("veto: misma foto/línea pero distinta VRAM nunca se fusiona, ni con MPN igual", () => {
    const offer = fp("gpu", "MSI RTX 4060 Ti Ventus 2X 16GB", { mpn: "V517-001R" });
    const decision = decide(offer, [existing(1, "gpu", "MSI RTX 4060 Ti Ventus 2X 8GB", { mpn: "V517-001R" })]);
    expect(decision).toEqual({ kind: "new_product" });
  });

  test("CPU: la clave es única → link por atributos aunque los títulos difieran", () => {
    const offer = fp("cpu", "Procesador AMD Ryzen 7 7800X3D 8 núcleos AM5 sin cooler");
    const decision = decide(offer, [existing(7, "cpu", "AMD RYZEN 7 7800X3D 4.2GHz Box")]);
    expect(decision).toMatchObject({ kind: "link", productId: 7, method: "attributes" });
  });

  test("CPU: modelo distinto (5600 vs 5600X) → producto nuevo", () => {
    const decision = decide(fp("cpu", "AMD Ryzen 5 5600X"), [existing(1, "cpu", "AMD Ryzen 5 5600")]);
    expect(decision).toEqual({ kind: "new_product" });
  });

  test("GPU: OC vs no-OC no se fusionan automáticamente", () => {
    const decision = decide(fp("gpu", "ASUS Dual RTX 4070 Super 12GB"), [
      existing(1, "gpu", "ASUS Dual RTX 4070 Super OC 12GB"),
    ]);
    expect(decision).toEqual({ kind: "new_product" });
  });

  test("GPU: misma clave y títulos muy parecidos → link por atributos", () => {
    const decision = decide(fp("gpu", "Tarjeta de Video Gigabyte RTX 5060 Windforce OC 8GB"), [
      existing(3, "gpu", "GIGABYTE GeForce RTX 5060 WINDFORCE OC 8G GDDR7"),
    ]);
    expect(decision).toMatchObject({ kind: "link", productId: 3, method: "attributes" });
  });

  test("RAM: misma clave pero títulos distintos (otra línea/color) → revisión humana", () => {
    const offer = fp("ram", "Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz Blanca");
    const decision = decide(offer, [existing(4, "ram", "Corsair Dominator Titanium 32GB 2x16GB DDR5 6000MHz")]);
    expect(decision.kind).toBe("review");
  });

  test("MPN en conflicto bloquea la fusión automática aunque la clave coincida", () => {
    const offer = fp("cpu", "AMD Ryzen 7 7800X3D", { mpn: "100-100000910WOF" });
    const comparison = compare(offer, fp("cpu", "AMD Ryzen 7 7800X3D", { mpn: "100-000000910" }));
    expect(comparison.evidence.mpnConflict).toBe(true);
    const decision = decide(offer, [
      { productId: 1, fingerprint: fp("cpu", "AMD Ryzen 7 7800X3D", { mpn: "100-000000910" }) },
    ]);
    expect(decision.kind).not.toBe("link");
  });

  test("sin candidatos → producto nuevo", () => {
    expect(decide(fp("case", "Gabinete Montech Air 903"), [])).toEqual({ kind: "new_product" });
  });
});
