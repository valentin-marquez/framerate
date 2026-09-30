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

  test("sin stock fuerza cantidad 0", () => {
    const result = normalizeOffer({ ...base, inStock: false, stockQuantity: 3 }, "gpu");
    expect(result.ok && result.offer.stockQuantity).toBe(0);
  });

  test.each([
    [{ title: "Tarjeta de Video RTX 4070 Super USADA" }, "condition:not_new"],
    [{ title: "Combo Ryzen 5 5600 + RTX 4060" }, "bundle"],
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
