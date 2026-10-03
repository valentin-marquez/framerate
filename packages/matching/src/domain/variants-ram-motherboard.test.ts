import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import { PROFILES } from "./attributes";
import { compare } from "./decide";
import { buildFingerprint } from "./fingerprint";

const vetoes = (category: Category, a: string, b: string, brandA?: string) =>
  compare(buildFingerprint({ category, title: a, brand: brandA }), buildFingerprint({ category, title: b })).vetoes;

describe("placa madre", () => {
  test.each([
    ["M/B MSI B450M-A PRO MAX", "Placa Madre MSI B450M-A PRO MAX II Socket AM4"],
    ["M/B ASUS PRIME A520M-A", "Placa Madre Asus Prime A520M-A II"],
    ["M/B ASUS PRIME H610M-K", "Placa Madre ASUS PRIME H610M-K D4-CSM"],
  ])("variante distinta: %s / %s", (a, b) => {
    expect(vetoes("motherboard", a, b)).toContain("attribute:variant");
  });

  test("la misma variante escrita distinto no veta", () => {
    expect(vetoes("motherboard", "M/B MSI B450M-A PRO MAX", "Placa Madre MSI B450M-A PRO MAX AM4 mATX")).toEqual([]);
  });

  test.each([
    ["M/B ASUS PRIME H610M-A", "M/B ASUS PRIME H610M-K", "attribute:model"],
    ["Placa Madre Gigabyte A520M DS3H V2 AM4 DDR4 mATX", "Gigabyte A520M-K V2 MicroATX AMD AM4", "attribute:model"],
    ["M/B MSI PRO B550M-P GEN3", "MSI B550M-A PRO, Micro ATX, AM4, DDR4", "attribute:model"],
    ["Placa Madre MSI PRO H610M-G DDR5", "MSI PRO H610M-G DDR4 LGA 1700 INTEL", "attribute:memory"],
    ["M/B ASUS PRIME B760M-A AX", "M/B ASUS PRIME B760M-A", "attribute:wifi"],
    ["M/B ASROCK B650M PG Lightning WiFi", "M/B ASROCK B650M PG RIPTIDE WIFI", "attribute:line"],
    [
      "Placa Madre sAM5 (AMD) - Gigabyte B650M AORUS Elite AX - 4x DDR5 - 2x M.2 - Wi-Fi 6E - DisplayPort/HDMI - m-ATX",
      "sAM5 (AMD) - Gigabyte B650M D3HP AX - 4x DDR5 - 2x M.2- Wi-Fi 6E - DisplayPort/HDMI - m-ATX",
      "attribute:line",
    ],
  ])("distintas: %s / %s", (a, b, veto) => {
    expect(vetoes("motherboard", a, b)).toContain(veto);
  });

  test.each([
    [
      "Gigabyte Placa Madre A520M-K-V2 Series 5000 Ryzen AM4 Ultra Durable GbE LAN Bandwidth Management PC",
      "Gigabyte A520M-K V2 MicroATX AMD AM4",
    ],
    [
      "M/B LGA s1851 (Intel) - MSI B860M GAMING PLUS - 4x DDR5 - WIFI - HDMI/DisplayPort/USB-C - mATX",
      "MSI B860M GAMING PLUS WIFI, LGA1851, mATX",
    ],
    ["PLACA MADRE ASROCK B550M PHANTOM 90-MXBE90-A0UAYAZ GAMING 4", "ASRock B550M Phantom Gaming 4, mATX, AM4"],
    ["M/B ASUS TUF GAMING B850M-PLUS WIFI", "ASUS TUF B850M Plus WiFi AM5"],
  ])("iguales: %s / %s", (a, b) => {
    expect(vetoes("motherboard", a, b)).toEqual([]);
  });

  test("con la marca de la tienda, Z790 Eagle AX es la misma", () => {
    expect(
      vetoes(
        "motherboard",
        "Placa Madre Intel Z790 Eagle AX (s1700)",
        "M/B LGA s1700 (Intel) - Gigabyte Z790 EAGLE AX - 4x DDR5 - 3x M.2 - Wi-Fi 6E",
        "Gigabyte",
      ),
    ).toEqual([]);
  });

  test("model junta chipset, formato y la letra del sufijo", () => {
    expect(PROFILES.motherboard.extract("M/B ASUS PRIME H610M-A").model).toBe("h610ma");
    expect(PROFILES.motherboard.extract("Placa Madre ASUS PRIME A520M-K").model).toBe("a520mk");
    expect(PROFILES.motherboard.extract("Placa Madre Gigabyte B650M D3HP").model).toBe("b650m");
  });
});

describe("RAM", () => {
  test.each([
    [
      "MEMORIA RAM KINGSTON FURY BEAST DDR5 4800MHz 16GB CL38",
      "KINGSTON FURY BEAST RGB DDR5 4800MHz 16GB CL38",
      "attribute:rgb",
    ],
    [
      "Memoria RAM Corsair Vengeance RGB RS 8GB x 3200Mhz DDR4",
      "Corsair Vengeance Lpx DDR4 8gb 3200mhz Black",
      "attribute:line",
    ],
    [
      "MEMORIA KIT CORSAIR DOMINATOR PLATINUM 32GB (2X16GB) 5600MHz DDR5 AMD EXPO",
      "KIT CORSAIR VEGEANCE 32GB (2X16GB) 5600MHz RGB AMD EXPO",
      "attribute:line",
    ],
    [
      "Memoria RAM 32GB (2*16GB) DDR5 5600MHz DIMM CL36 Non-ECC 1.25v 288p Fury Beas",
      "32GB DDR5 5600MT/s CL36 FURY Beast Black EXPO",
      "attribute:modules",
    ],
  ])("distintas: %s / %s", (a, b, veto) => {
    expect(vetoes("ram", a, b)).toContain(veto);
  });

  test.each([
    [
      "A-DATA XPG Spectrix D35G AX4U32008G16A-SBKD35G (1 x 8 GB DIMM DDR4-3200)",
      "ADATA XPG SPECTRIX D35G 8GB 3200MHz DDR4 RGB",
    ],
    [
      "Memoria RAM 32GB DDR5 6400 MHz UDIMM",
      "Memoria DDR5 Kingston Fury Beast 32Gb Negra con RGB 6400MT/s EXPO - KF564C32BBEA-32",
    ],
    [
      "Memoria RAM 32GB (2*16GB) DDR5 5600MHz DIMM CL36 Non-ECC 1.25v 288p Fury Beas",
      "Kit de Memoria KINGSTON Fury 32GB 5600MT/s DDR5 CL36 DIMM (Kit 2x16GB ) Black KF556C36BBEK2-32",
    ],
    [
      "Memoria RAM DIMM 8 GB - DDR5 5600 MT/s - XPG Lancer Blade - Black - Intel XMP/AMD EXPO",
      "MEMORIA DDR5 XPG LANCER UDIMM ADATA 8GB 5600MHZ BLACK P/N AX5U5600C468G-SLABBK",
    ],
  ])("iguales: %s / %s", (a, b) => {
    expect(vetoes("ram", a, b)).toEqual([]);
  });

  test("kits escritos al revés o con asterisco", () => {
    expect(PROFILES.ram.extract("Memoria Kingston Fury Beast 16GB x2 DDR5 5600")).toMatchObject({
      modules: 2,
      capacity: 32,
    });
    expect(PROFILES.ram.extract("Memoria 32GB (2*16GB) DDR5 5600MHz")).toMatchObject({ modules: 2, capacity: 32 });
    expect(PROFILES.ram.extract("Corsair Vengeance 32GB DDR5 6000 (Kit of 2)")).toMatchObject({ modules: 2 });
  });

  test("RGB sólo es falso cuando el título dice la línea", () => {
    expect(PROFILES.ram.extract("Kingston Fury Beast 16GB DDR5 5600").rgb).toBe(false);
    expect(PROFILES.ram.extract("Memoria RAM 16GB DDR5 5600").rgb).toBeUndefined();
  });
});
