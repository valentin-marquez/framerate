import { describe, expect, test } from "bun:test";
import { cleanTitle, normalizeOffer, type RawOffer } from "./normalize";

test("cleanTitle quita las barras separadoras y el ruido comercial", () => {
  expect(cleanTitle("Nvidia RTX 3050 | MSI Ventus 2X | 6GB GDDR6")).toBe("Nvidia RTX 3050 MSI Ventus 2X 6GB GDDR6");
  expect(cleanTitle("¡OFERTA! SSD Kingston NV3 1TB")).toBe("SSD Kingston NV3 1TB");
});

const base: RawOffer = {
  externalId: "123",
  url: "https://tienda.cl/producto/asus-dual-rtx-4070-super",
  title: "Tarjeta de Video ASUS Dual RTX 4070 SUPER OC 12GB",
  category: "gpu",
  priceCash: 649_990,
  priceCard: 689_990,
  inStock: true,
  stockQuantity: 4,
  brand: null,
  mpn: "DUAL-RTX4070S-O12G",
  gtin: null,
  imageUrls: ["https://tienda.cl/img/1.jpg"],
};

describe("normalizeOffer", () => {
  test("oferta válida: normaliza MPN, marca y atributos", () => {
    const result = normalizeOffer(base, "gpu");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offer.mpn).toBe("DUALRTX4070SO12G");
    expect(result.offer.brand).toBe("ASUS");
    expect(result.offer.attributes).toMatchObject({ chipset: "rtx 4070 super", vram: 12 });
  });

  test("precios invertidos se corrigen (efectivo = menor)", () => {
    const result = normalizeOffer({ ...base, priceCash: 689_990, priceCard: 649_990 }, "gpu");
    expect(result.ok && [result.offer.priceCash, result.offer.priceCard]).toEqual([649_990, 689_990]);
  });

  test("precio único: tarjeta = efectivo", () => {
    const result = normalizeOffer({ ...base, priceCard: null }, "gpu");
    expect(result.ok && result.offer.priceCard).toBe(649_990);
  });

  test("en cpu_cooler, un ventilador de gabinete va a cuarentena y un cooler que dice CPU no", () => {
    const cooler = (title: string) =>
      normalizeOffer({ ...base, category: "cpu_cooler", priceCash: 29_990, priceCard: null, title }, "cpu_cooler");
    expect(cooler("Pack X3 Ventiladores XPG Vento R ARGB 120 Negro")).toMatchObject({ reason: "category:case_fan" });
    expect(cooler("Ventilador Exodia ARGB Negro 120mm")).toMatchObject({ reason: "category:case_fan" });
    expect(cooler("Ventilador CPU - Gamdias Boreas E1-210 Lite - Torre Simple").ok).toBe(true);
    expect(cooler("Refrigeración Líquida CPU - Gamdias Aura GL240").ok).toBe(true);
  });

  test.each([
    ["ssd", "Disco Duro Externo SSD Kingston XS1000 1TB USB 3.2", "category:external_drive"],
    ["hdd", "Disco Duro LaCie Rugged Mini 2TB USB-C Portátil", "category:external_drive"],
    ["ssd", "SSD 32 GB DDR4 Kingston Fury Impact KF432S20IB/32", "category:other_product"],
    ["case_fan", "Ventilador CPU Morpheus TJ400 ARGB", "category:cpu_cooler"],
    ["case_fan", "Refrigeración líquida MSI MAG CoreLiquid 360R", "category:cpu_cooler"],
    ["cpu_cooler", "Pasta Térmica CoolerMaster Cryofuze 5", "category:other_product"],
    ["case", "Gabinete Casecom CM-01 ATX (caja mala)", "condition:not_new"],
    ["ram", "Pack de Memoria RAM + Disco SSD Kingston 16GB DDR4", "bundle"],
  ] as const)("cuarentena en %s: %s → %s", (category, title, reason) => {
    const result = normalizeOffer({ ...base, category, title, priceCash: 49_990, priceCard: null }, category);
    expect(result).toMatchObject({ ok: false, reason });
  });

  test("en ventiladores, un pack o un kit con controladora es un producto, no un bundle", () => {
    for (const title of [
      "PACK DE 3 VENTILADORES ANTEC C120 ARGB White",
      "KIT DE VENTILADORES (X3) ANTEC FUSION 120MM ARGB + CONTROLADORA",
    ]) {
      expect(normalizeOffer({ ...base, category: "case_fan", title, priceCash: 29_990 }, "case_fan").ok).toBe(true);
    }
  });

  test("sin stock fuerza cantidad 0", () => {
    const result = normalizeOffer({ ...base, inStock: false, stockQuantity: 3 }, "gpu");
    expect(result.ok && result.offer.stockQuantity).toBe(0);
  });

  test.each([
    [{ title: "Tarjeta de Video RTX 4070 Super USADA" }, "condition:not_new"],
    [{ title: "Combo Ryzen 5 5600 + RTX 4060" }, "bundle"],
    [{ title: "KIT MSI B650 Gaming + Tarjeta de Video RTX 4060 8GB" }, "bundle"],
    [{ title: "Notebook ASUS TUF RTX 4060 16GB" }, "category:other_product"],
    [{ priceCash: 990 }, "price:out_of_range"],
    [{ title: "Soporte anti-sag para tarjeta de video" }, "attribute:missing:chipset"],
    [{ category: "cpu" }, "category:unexpected"],
    [{ priceCash: -1 }, "schema:priceCash:too_small"],
    [{ url: "no-es-url" }, "schema:url:invalid_format"],
  ] as const)("cuarentena: %o → %s", (patch, reason) => {
    const result = normalizeOffer({ ...base, ...patch }, "gpu");
    expect(result).toEqual({ ok: false, externalId: "123", reason });
  });

  test("limpia ruido de marketing y entidades HTML del título", () => {
    const result = normalizeOffer(
      { ...base, title: "¡OFERTA! ASUS Dual RTX 4070 SUPER 12GB &quot;OC&quot; envío gratis" },
      "gpu",
    );
    expect(result.ok && result.offer.title).toBe('ASUS Dual RTX 4070 SUPER 12GB "OC"');
  });
});
