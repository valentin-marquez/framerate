import { describe, expect, test } from "bun:test";
import { normalizeMotherboardTitle } from "../src/processors/normalizers/motherboard";

describe("Motherboard Title Normalization", () => {
  test("removes common prefixes", () => {
    expect(normalizeMotherboardTitle("PLACA MADRE ASUS PRIME B550M-A")).toBe("Asus Prime B550M-A");
    expect(normalizeMotherboardTitle("Motherboard Gigabyte B650M")).toBe("Gigabyte B650M");
  });

  test("removes P/N and suffixes", () => {
    expect(normalizeMotherboardTitle("MSI PRO B650M-A WIFI P/N 12345")).toBe("MSI Pro B650M-A WiFi");
    expect(normalizeMotherboardTitle("ASUS ROG STRIX B550-F GAMING - P")).toBe("Asus ROG Strix B550-F Gaming");
    expect(normalizeMotherboardTitle("GIGABYTE B650 AORUS ELITE AX - ATX -")).toBe("Gigabyte B650 Aorus Elite AX");
  });

  test("standardizes WiFi", () => {
    expect(normalizeMotherboardTitle("MSI MAG B650 TOMAHAWK WIFI 6E")).toBe("MSI MAG B650 Tomahawk WiFi 6E");
    expect(normalizeMotherboardTitle("ASUS TUF GAMING B650-PLUS WIFI7")).toBe("Asus TUF Gaming B650-Plus WiFi 7");
    expect(normalizeMotherboardTitle("GIGABYTE B650M GAMING X AX WF7")).toBe("Gigabyte B650M Gaming X AX WiFi 7");
  });

  test("removes redundant sockets", () => {
    expect(normalizeMotherboardTitle("ASUS PRIME B650M-A II sAM5")).toBe("Asus Prime B650M-A II");
    expect(normalizeMotherboardTitle("GIGABYTE B760M DS3H sLGA1700")).toBe("Gigabyte B760M DS3H");
    expect(normalizeMotherboardTitle("MSI PRO B650M-P AM5")).toBe("MSI Pro B650M-P");
    expect(normalizeMotherboardTitle("ASROCK B650M-HDV/M.2 Socket AM5")).toBe("ASRock B650M-HDV/M.2");
  });

  test("fixes casing for specific terms", () => {
    expect(normalizeMotherboardTitle("GIGABYTE B650 AORUS ELITE AX ICE")).toBe("Gigabyte B650 Aorus Elite AX ICE");
    expect(normalizeMotherboardTitle("MSI MPG B650I EDGE WIFI")).toBe("MSI MPG B650I Edge WiFi");
    expect(normalizeMotherboardTitle("ASROCK B650M PG LIGHTNING WIFI")).toBe("ASRock B650M PG Lightning WiFi");
  });

  test("handles SP Digital format", () => {
    expect(normalizeMotherboardTitle("GIGABYTE B650M GAMING WIFI, AM5, DDR5")).toBe("Gigabyte B650M Gaming WiFi");
  });

  test("handles ICE-P suffix", () => {
    expect(normalizeMotherboardTitle("GIGABYTE B650M AORUS ELITE AX ICE-P")).toBe("Gigabyte B650M Aorus Elite AX ICE");
  });

  test("fixes user reported edge cases", () => {
    expect(normalizeMotherboardTitle("Gigabyte X870 Aorus Elite WiFi 7 ICE -")).toBe(
      "Gigabyte X870 Aorus Elite WiFi 7 ICE",
    );
    expect(normalizeMotherboardTitle("Asus Prime X870-P WiFi - ATX -")).toBe("Asus Prime X870-P WiFi");
    expect(normalizeMotherboardTitle("ASRock FM2A68M-DG3+ DVI/VGA S/V/L sFM2+")).toBe(
      "ASRock FM2A68M-DG3+ DVI/VGA S/V/L",
    );
    expect(normalizeMotherboardTitle("Gigabyte B550 A Elite AX v3")).toBe("Gigabyte B550 A Elite AX V3");
  });
});
