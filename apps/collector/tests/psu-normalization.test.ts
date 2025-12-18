import { describe, expect, test } from "bun:test";
import { normalizePsuTitle } from "../src/processors/normalizers/psu";

describe("PSU Title Normalization", () => {
  test("normalizes Antec PSUs", () => {
    expect(normalizePsuTitle("FUENTE DE PODER ANTEC 750W SEMI MODULAR BRONZE CSK750H EC P/N 0-761345-11768-5")).toBe(
      "Antec Cuprum Strike CSK750H 750W 80+ Bronze Semi-Modular",
    );
    expect(
      normalizePsuTitle("FUENTE DE PODER ANTEC 1300w NE1300G M FULL MODULAR ATX3.0 80 PLUS GOLD EC 0-761345-11398-4"),
    ).toBe("Antec NeoEco NE1300G 1300W 80+ Gold Fully Modular");
    expect(normalizePsuTitle("FUENTE DE PODER ANTEC 550W MODELO CSK550 EC 80PLUS BRONZE")).toBe(
      "Antec Cuprum Strike CSK550 550W 80+ Bronze",
    );

    // New cases
    expect(normalizePsuTitle("Antec SFF SF850X- 5.1 3.1 850W 80+ Gold Modular SFX")).toBe(
      "Antec SF850X 850W 80+ Gold Modular SFX",
    );
    expect(normalizePsuTitle("Antec NE550M V2 80 80+ Bronze")).toBe("Antec NeoEco NE550M V2 550W 80+ Bronze");
    expect(normalizePsuTitle("Antec Atom B750 750W")).toBe("Antec Atom B750 750W 80+ Bronze");
    expect(normalizePsuTitle("Antec NeoEco NE650G PCI 5.0 650W 80+ Bronze Modular")).toBe(
      "Antec NeoEco NE650G 650W 80+ Bronze Modular",
    );
  });

  test("normalizes Corsair PSUs", () => {
    expect(
      normalizePsuTitle("Fuente de Poder 750W Corsair RM750e, 80 PLUS Gold, ATX 3.1, PCIe 5.1, 12V-2x6, Modular"),
    ).toBe("Corsair RM750e 750W 80+ Gold Modular");
    expect(
      normalizePsuTitle(
        "Fuente de Poder Corsair HX1200i, 1200W, Full Modular, 2x 12V-2x6, Certificada 80 Plus Platinum",
      ),
    ).toBe("Corsair HX1200i 1200W 80+ Platinum Fully Modular");

    // New cases
    expect(normalizePsuTitle("Corsair CX750 Bronze ATX 750W 80+ White")).toBe("Corsair CX750 750W 80+ Bronze");
    expect(normalizePsuTitle("Corsair RM1000e 1000W Fully Modular")).toBe(
      "Corsair RM1000e 1000W 80+ Gold Fully Modular",
    );
  });

  test("normalizes XPG/ADATA PSUs", () => {
    expect(normalizePsuTitle("FUENTE DE PODER ADATA XPG KYBER 650W GOLD ATX 12V 2.52 P/N KYBER650G-BKCEU")).toBe(
      "XPG Kyber 650W 80+ Gold",
    );
    expect(normalizePsuTitle("Fuente de Poder XPG PYLON, 650W, PFC Activo, Certificación 80 PLUS Bronze, Negro")).toBe(
      "XPG Pylon 650W 80+ Bronze",
    );

    // New cases
    expect(normalizePsuTitle("XPG Pylon BRONZE 750W 80+ Bronze")).toBe("XPG Pylon 750W 80+ Bronze");
  });

  test("normalizes Gamemax PSUs", () => {
    expect(normalizePsuTitle("FUENTE DE PODER GAMEMAX RGB 1300W BK 80PLUS PLATINIUM 3,1/5,1")).toBe(
      "Gamemax RGB 1300W 80+ Platinum",
    );
    expect(
      normalizePsuTitle("FUENTE DE PODER SLIM SFX GAMEMAX 275W REALES 80 PLUS 110V / 220V MICROATX P/N GS-275"),
    ).toBe("Gamemax GS-275 275W 80+ White SFX Slim");

    // New cases
    expect(normalizePsuTitle("Gamemax GP-650 Bronze 650W 80+ White")).toBe("Gamemax GP-650 650W 80+ Bronze");
    expect(normalizePsuTitle("Gamemax GX-1050 3.0 GX-1050BLACK3.0 80+ Gold")).toBe("Gamemax GX-1050 1050W 80+ Gold");
  });

  test("normalizes Be quiet! PSUs", () => {
    expect(normalizePsuTitle("Be quiet! Be quiet! System Power 11 U 750W 80+ Bronze")).toBe(
      "Be quiet! System Power 11 U 750W 80+ Bronze",
    );
  });

  test("normalizes Cooler Master PSUs", () => {
    expect(normalizePsuTitle("Cooler Master MWE Gold V3 MPX-7503-AFAG-2EBWO 750W 80+ Gold Modular")).toBe(
      "Cooler Master MWE Gold V3 750W 80+ Gold Modular",
    );
    expect(
      normalizePsuTitle("Cooler Master ELITE GOLD ATX 12V VER 3.1 MPW-A001-AFAG-BWO CORD 1000W 80+ Gold Modular"),
    ).toBe("Cooler Master Elite Gold 1000W 80+ Gold Modular");
    expect(normalizePsuTitle("Cooler Master Elite NEX WHITE 700W White")).toBe("Cooler Master Elite NEX 700W White");
  });

  test("normalizes generic/other brands", () => {
    expect(normalizePsuTitle("FUENTE DE PODER 650W 20+4 2 SATA 2 MOLEX CLIO CON SWITCH CORTE 220V")).toBe("Clio 650W");
    expect(normalizePsuTitle("FUENTE DE PODER XTECH 700W P/N LLK-CS850XTK08")).toBe("Xtech 700W");
    expect(normalizePsuTitle("Fuente de poder Cougar 400W STC 80 Plus White - 31SC040005P01")).toBe(
      "Cougar STC 400W 80+ White",
    );

    // New cases
    expect(normalizePsuTitle("Gigabyte GP-P750BS ATX Color 750W 80+ Bronze")).toBe(
      "Gigabyte GP-P750BS 750W 80+ Bronze",
    );
    expect(normalizePsuTitle("MSI MAG A650BN ATX 650W 80+ Bronze")).toBe("MSI MAG A650BN 650W 80+ Bronze");
    expect(normalizePsuTitle("Generic Xyz volt 700W 80+ Bronze")).toBe("XYZ Volt 700W 80+ Bronze");
    expect(normalizePsuTitle("Xtech pin 600W")).toBe("Xtech 600W");
    expect(normalizePsuTitle("Clio 3.15.1 - ATX PRO-M--FM 850W 80+ Gold Modular")).toBe(
      "Clio Pro-M 850W 80+ Gold Modular",
    );
  });

  test("handles certifications correctly", () => {
    expect(
      normalizePsuTitle(
        "Fuente de Poder 700W XYZ VOLT, Cables Planos, PFC Activo, Certificada 80 PLUS Bronze",
        undefined,
        "XYZ",
      ),
    ).toBe("XYZ Volt 700W 80+ Bronze");
  });
});
