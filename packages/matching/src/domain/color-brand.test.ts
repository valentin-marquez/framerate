import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import { PROFILES } from "./attributes";
import { canonicalBrand, detectBrand } from "./brands";
import { compare } from "./decide";
import { buildFingerprint } from "./fingerprint";

const vetoes = (category: Category, a: string, b: string) =>
  compare(buildFingerprint({ category, title: a }), buildFingerprint({ category, title: b })).vetoes;

describe("color", () => {
  test.each([
    [
      "gpu",
      "Tarjeta de Video MSI GeForce RTX 5060 8G VENTUS 2X OC",
      "Tarjeta de Video MSI GeForce RTX 5060 Ventus 2X White OC 8GB GDDR7",
    ],
    [
      "gpu",
      "Tarjeta de Video Gigabyte RTX 5060 EAGLE OC 8GB GDDR7",
      "Gigabyte GeForce RTX 5060 EAGLE OC ICE 8G [GV-N5060EAGLEOC ICE-8GD]",
    ],
    ["gpu", "TARJETA DE VIDEO ASROCK CHALLENGER D RX 6600 8GB DDR6", "ASROCK RX 6600 CHALLENGER WHITE 8GB DDR6"],
    [
      "psu",
      "FUENTE CERTIFICADA ANTEC 850W GSK850 V2 WHITE EC 80PLUS GOLD",
      "CERTIFICADA ANTEC 850W GSK850 V2 EC 80PLUSGOLD",
    ],
    [
      "psu",
      "Fuente de Poder NZXT C850 Gold ATX 3.1, 850W, 80+ Gold White",
      "Fuente de Poder NZXT C850 Gold ATX 3.1 - 850W, 80 Plus Gold",
    ],
    ["ram", "MEMORIA ADATA XPG GAMMIX D35 8GB 3200MHz", "ADATA XPG GAMMIX D35 8GB 3200MHz WH"],
    [
      "motherboard",
      "Placa Madre sAM5 (AMD) - Gigabyte B850M EAGLE WIFI6E ICE - 4x DDR5 - 2x M.2- Wi-Fi 6E - DisplayPort/HDMI - m-ATX",
      "Gigabyte B850M EAGLE WIFI6E, ATX, AM5",
    ],
  ] as const)("%s blanca contra negra: %s / %s", (category, a, b) => {
    expect(vetoes(category, a, b)).toContain("attribute:color");
  });

  test("sin color escrito es la negra; dicho en ambos lados no veta", () => {
    expect(PROFILES.gpu.extract("MSI RTX 5070 Ti 16G VENTUS 3X OC").color).toBe("black");
    expect(vetoes("gpu", "MSI RTX 5070 Ti 16G VENTUS 3X OC Black", "MSI GeForce RTX 5070 Ti 16G VENTUS 3X OC")).toEqual(
      [],
    );
    expect(
      vetoes("gpu", "MSI GeForce RTX 5080 Gaming Trio White OC 16GB", "MSI RTX 5080 16G GAMING TRIO OC WHITE"),
    ).toEqual([]);
  });

  // La certificación se comprueba en los tests de fuentes; aquí sólo importa que no se lea como color.
  test("80 Plus White es certificación, no color", () => {
    expect(PROFILES.psu.extract("Fuente 700W EVGA 80+White").color).toBe("black");
    expect(PROFILES.psu.extract("Fuente EVGA 600W 80 Plus White").color).toBe("black");
    expect(PROFILES.psu.extract("Fuente Gigabyte P650SS ICE White (650W)").color).toBe("white");
  });

  test("en coolers, gabinetes y ventiladores sólo cuenta si el título lo dice, e ICE no es color", () => {
    expect(PROFILES.cpu_cooler.extract("ASUS Cooling system - 90RC01N2-B0AAY0").color).toBeUndefined();
    expect(PROFILES.cpu_cooler.extract("Cooler GameMax Ice Force BK").color).toBe("black");
    expect(PROFILES.case.extract("Gabinete Antec NX200 White").color).toBe("white");
  });
});

describe("marca", () => {
  test("en GPU y placa, el ensamblador del título gana a la marca declarada", () => {
    const board = (title: string, brand: string) => buildFingerprint({ category: "motherboard", title, brand }).brand;
    expect(board("Placa Madre Gigabyte AMD B850 Gaming Wifi 6", "AMD")).toBe(canonicalBrand("Gigabyte"));
    expect(board("M/B MSI PRO B840M-P WIFI6E", "ASUS")).toBe(canonicalBrand("MSI"));
    expect(board("Placa Madre AMD B850M", "AMD")).toBeNull();
  });

  test("en el resto, la marca declarada se mantiene", () => {
    const cpu = buildFingerprint({ category: "cpu", title: "CPU Intel XEON Silver 4314 CPU FOR HPE", brand: "Intel" });
    expect(cpu.brand).toBe(canonicalBrand("Intel"));
    const ram = buildFingerprint({
      category: "ram",
      title: "Memoria XPG Lancer RGB ROG 16GB DDR5 6000",
      brand: "ADATA",
    });
    expect(ram.brand).toBe(canonicalBrand("ADATA"));
  });
});

test("marcas de las tiendas nuevas (#159)", () => {
  expect(detectBrand("Gabinete BitFenix/ Light ATX")).toBe("BitFenix");
  expect(detectBrand("Gabinete NWG Phantom")).toBe("Newgen");
  expect(detectBrand("Gabinete Jonsbo D31 Mesh")).toBe("Jonsbo");
  expect(detectBrand("Cooler PCCOOLER RZ620")).toBe("PCCOOLER");
  expect(detectBrand("Fuente WJ Coolman 600W")).toBe("WJ Coolman");
  expect(detectBrand("Gabinete Segotep Lux")).toBe("Segotep");
});
