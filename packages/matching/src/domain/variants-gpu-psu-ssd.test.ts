import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import { PROFILES } from "./attributes";
import { compare } from "./decide";
import { buildFingerprint } from "./fingerprint";

// Lo que separa a los dos títulos: un veto o un campo de texto libre distinto (no veta, pero no vincula solo).
const vetoes = (category: Category, a: string, b: string) => {
  const { vetoes, evidence } = compare(
    buildFingerprint({ category, title: a }),
    buildFingerprint({ category, title: b }),
  );
  return [...vetoes, ...(evidence.textMismatch ?? []).map((f) => `attribute:${f}`)];
};

describe("GPU", () => {
  test.each([
    [
      "Tarjeta de Video Gigabyte GeForce RTX 5050 WINDFORCE OC 8G",
      "Tarjeta de Video Gigabyte RTX 5050 WINDFORCE OC V2 8 GB",
    ],
    [
      "Tarjeta de Video Gigabyte GeForce RTX 5060 WINDFORCE OC 8GB",
      "Tarjeta de Video Gigabyte NV-GF RTX5060 WindForce MAX OC 8GB GDDR7 3*DP 1*HDMI",
    ],
    ["TARJETA DE VIDEO ASUS DUAL RX 7600 V2 8GB DDR6 OC", "ASUS Radeon RX 7600 Dual EVO OC 8GB GDDR6"],
  ])("variante distinta: %s / %s", (a, b) => {
    expect(vetoes("gpu", a, b)).toContain("attribute:variant");
  });

  test.each([
    ["Tarjeta de Video ASUS Dual RTX 5060 Ti EVO OC 16GB GDDR7", "ASUS Dual GeForce RTX 5060 Ti EVO 16GB OC Edition"],
    [
      "Tarjeta de Video MSI RTX 5070 Ti 16G VENTUS 3X OC Black",
      "Tarjeta de Video MSI GeForce RTX 5070 Ti 16G VENTUS 3X OC",
    ],
    ["Tarjeta de Video MSI GeForce RTX 5080 Gaming Trio White OC 16GB GDDR7", "MSI RTX 5080 16G GAMING TRIO OC WHITE"],
    // OC en la notación de ASUS ("O8GB", "O 12G") o abreviado ("OCEd").
    ["Tarjeta de Video Asus DUAL RTX5060 O8GB EVO", "ASUS Dual GeForce RTX 5060 EVO OC 8GB GDDR7"],
    ["Tarjeta de Video Asus Prime Radeon RX9070GRE O 12G", "ASUS Prime Radeon RX 9070 GRE OC 12GB"],
    ["Tarjeta de Video Asus ROG Astral RTX 5080 OCEd 16GB GDDR7", "Asus ROG Astral RTX 5080 16GB GDDR7 OC Edition"],
  ])("iguales: %s / %s", (a, b) => {
    expect(vetoes("gpu", a, b)).toEqual([]);
  });

  test("una palabra terminada en o antes de la memoria no es OC", () => {
    expect(PROFILES.gpu.extract("Tarjeta de Video Gigabyte RTX 5060 Eagle Pro 8G").oc).toBe(false);
  });
});

describe("fuentes", () => {
  test("certificación: bronce, platinium, pegada y nunca el color", () => {
    expect(PROFILES.psu.extract("Fuente MSI MAG A750BN PCIE5 - 80 PLUS Bronce").efficiency).toBe("bronze");
    expect(PROFILES.psu.extract("FUENTE ANTEC 850W GSK850 V2 WHITE EC 80PLUS GOLD").efficiency).toBe("gold");
    expect(PROFILES.psu.extract("Fuente de Poder ASUS ROG STRIX 1000W Platinium Full Modular").efficiency).toBe(
      "platinum",
    );
    expect(PROFILES.psu.extract("Fuente Gigabyte P650SS ICE White (650W)").efficiency).toBeUndefined();
    expect(PROFILES.psu.extract("Fuente 700W EVGA 80+White").efficiency).toBe("white");
    expect(PROFILES.psu.extract("Fuente SilverStone 650W 80 Plus Bronze").efficiency).toBe("bronze");
  });

  test.each([
    [
      "Fuente de Poder be quiet! PURE POWER 12 850W 80 PLUS Gold",
      "Fuente de Poder be quiet! PURE POWER 13 M 850W 80 PLUS Gold",
      "attribute:line",
    ],
    ["ASUS TUF Gaming 1000G 80 PLUS Gold", "ASUS ROG STRIX-1000G 1000W 80 PLUS GOLD F.MODULAR", "attribute:line"],
    [
      "Fuente de Poder ASUS ROG Thor 1200W Platinum III",
      "Fuente de Poder Asus ROG Thor Platinum II de 1200 W",
      "attribute:revision",
    ],
  ])("distintas: %s / %s", (a, b, veto) => {
    expect(vetoes("psu", a, b)).toContain(veto);
  });

  test.each([
    [
      "Fuente de Poder be quiet! Pure Power 13 M 750W 80 PLUS GOLD",
      "Fuente de Poder be quiet! PURE POWER 13 M 750W 80 PLUS Gold",
    ],
    ["FUENTE DE PODER ASUS ROG THOR 1200W 80PLUS PLATINUM", "ASUS ROG Thor 1200W Platinum III"],
  ])("iguales: %s / %s", (a, b) => {
    expect(vetoes("psu", a, b)).toEqual([]);
  });
});

describe("SSD", () => {
  test("NV1 contra Renegade es otra línea, y 480 sin unidad no es una serie", () => {
    expect(
      vetoes("ssd", "DISCO DURO SSD NVMe KINGSTON NV1 1TB", "Disco Duro SSD M.2 NVME Kingston FURY Renegade 1 TB"),
    ).toContain("attribute:line");
    expect(PROFILES.ssd.extract("SSD Kingston 480 A400 sata").series).toBeUndefined();
  });

  test.each([
    [
      "Kingston SSD 1TB NV3 M.2 2230 NVMe PCIe 4.0",
      "Kingston NV3 M.2 2280 Nvme 4.0 Gen 4×4 Ultra Fast 1TB",
      "attribute:formFactor",
    ],
    [
      "Unidad SSD Kingston FURY Renegade G5 2TB, M.2 2280, PCIe 5.0 NVMe",
      "Disco Estado Sólido Kingston Fury Renegade 2TB NVMe PCIe 4.0",
      "attribute:pcieGen",
    ],
    ["DISCO SSD M.2 CRUCIAL P3 1TB NVMe PCIe 3.0", "M.2 CRUCIAL P3 PLUS 1TB NVMe PCIe 4.0", "attribute:pcieGen"],
    ["DISCO ADATA LEGEND 800 2TB NVME", "DISCO ADATA LEGEND 860 2TB NVME", "attribute:series"],
  ])("distintas: %s / %s", (a, b, veto) => {
    expect(vetoes("ssd", a, b)).toContain(veto);
  });

  test.each([
    [
      "Unidad SSD Kingston NV3 500GB M.2 22*80 PCIe4x4 NVMe Lec5000MB/s Esc3000MB/s",
      "SSD M.2 Kingston NV3 500 GB PCIe 4.0 x4",
    ],
    ["SSD M.2 (2280) - 2 TB - Adata Legend 860 - PCIe Gen4 x4 (SLEG-860-2000GCS)", "DISCO ADATA LEGEND 860 2TB NVME"],
    // 1024 GB es el mismo SSD de 1 TB escrito en binario.
    ["Disco estado sólido Kingston SKC600 de 1024GB (SATA, NAND 3D TLC)", "Kingston KC600 SSD 1TB SATA 6Gb/s"],
    ["Disco SSD 4096GB Kingston Fury Renegade G5 PCIe 5.", "Kingston FURY Renegade G5 4TB SSD M.2 PCIe 5.0 NVMe"],
  ])("iguales: %s / %s", (a, b) => {
    expect(vetoes("ssd", a, b)).toEqual([]);
  });

  test("capacidad: el punto de miles no es decimal y 512 GB sigue siendo 512", () => {
    expect(PROFILES.ssd.extract("Disco SSD 8.192GB interno Kingston FURY Renegade G5 M.2 2280").capacity).toBe(8000);
    expect(PROFILES.ssd.extract("SSD Kingston NV3 512GB NVMe").capacity).toBe(512);
    expect(PROFILES.ssd.extract("SSD Samsung 870 EVO 1.5TB").capacity).toBe(1500);
  });
});
