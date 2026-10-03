import { describe, expect, test } from "bun:test";
import { codesInTitle, normalizeGtin, normalizeMpn } from "./identifiers";

describe("códigos en el título", () => {
  test.each([
    ["Memoria RAM DIMM 16 GB DDR5 6000 MT/s - Corsair Vengeance (CMK16GX5M1D6000Z38)", "CMK16GX5M1D6000Z38"],
    [
      "Memoria RAM DIMM 16 GB - DDR5 5600 MT/s - Kingston Fury Beast RGB Black - Intel XMP (KF556C40BBA-16)",
      "KF556C40BBA16",
    ],
    ["MEMORIA DDR5 ADATA UDIMM 16GB 5600MHZ BLACK P/N AD5U560016G-S", "AD5U560016GS"],
    ["ASUS Prime Radeon RX 9060 XT 16GB GDDR6 OC Edition [PRIME-RX9060XT-O16G]", "PRIMERX9060XTO16G"],
    ["Placa Madre Asus A520M-K Prime AMD Micro ATX DDR5 PCIe 3.0 M.2 (90MB1500-M0EAY0)", "90MB1500M0EAY0"],
    ["Gigabyte GeForce RTX 5060 Ti EAGLE OC 8G [GV-N506TEAGLE OC-8GD]", "GVN506TEAGLEOC8GD"],
    ["ASUS Dual Radeon RX 9060 XT 16GB [DUAL-RX9060XT-16G / 90YV0LG2-MVAA00]", "DUALRX9060XT16G"],
    ["FUENTE GAMEMAX 800W P/N GM-800B BK", "GM800BBK"],
  ])("MPN: %s", (title, mpn) => {
    expect(codesInTitle(title).mpn).toBe(mpn);
  });

  test("dígitos con guiones son GTIN sólo con 12 a 14 dígitos", () => {
    expect(codesInTitle("PLACA MADRE MSI B860M GAMING PLUS WIFI Intel B860 P/N 824142392935").gtin).toBe(
      normalizeGtin("824142392935"),
    );
    expect(codesInTitle("Fuente XPG Pylon 650W P/N 15260475")).toEqual({ mpn: null, gtin: null });
  });

  test.each([
    "Memoria Corsair 32GB (2x16GB)",
    "Tarjeta de Video MSI GeForce RTX 3050 GAMING X 6G (96 bit)",
    "Cooler Deepcool AK400 (LGA1700/AM5)",
    "Disco HPE 1TB (ML30/MicroServer)",
    "Procesador Intel Core i5 12400 (s1700)",
    "Fuente Cougar 650W (650W)",
    "Fuente Cougar Atlas 650W (2024)",
    "Memoria Kingston 16GB (1 x 16GB | SO-DIMM DDR4-3200)",
    "Tarjeta de Video Zotac (RTX4060TI)",
    "Placa Madre MSI (B550M)",
  ])("rechaza especificaciones y nombres de chip: %s", (title) => {
    expect(codesInTitle(title)).toEqual({ mpn: null, gtin: null });
  });

  test("normalizeMpn ignora los guiones no separables de ETChile", () => {
    expect(normalizeMpn("AX5U5600C4616G‑DCLARBK")).toBe("AX5U5600C4616GDCLARBK");
  });
});
