import { describe, expect, test } from "bun:test";
import { SOURCE_TEXT_MAX } from "@framerate/contracts";
import { cleanTitle, clipSourceText, normalizeOffer, type RawOffer } from "./normalize";

test("cleanTitle quita las barras separadoras y el ruido comercial", () => {
  expect(cleanTitle("Nvidia RTX 3050 | MSI Ventus 2X | 6GB GDDR6")).toBe("Nvidia RTX 3050 MSI Ventus 2X 6GB GDDR6");
  expect(cleanTitle("¡OFERTA! SSD Kingston NV3 1TB")).toBe("SSD Kingston NV3 1TB");
});

test("cleanTitle quita el (clone) que Tecnomas deja en las fichas copiadas, con el código viejo que lo sigue", () => {
  expect(cleanTitle("Zotac GAMING GeForce RTX 5070 SOLID OC (clone) [ZT-B50700J-10P]")).toBe(
    "Zotac GAMING GeForce RTX 5070 SOLID OC",
  );
  expect(cleanTitle("Kingston Fury [KF560C36] 16GB")).toBe("Kingston Fury [KF560C36] 16GB");
  expect(cleanTitle("Zotac RTX 5070 Ti SOLID SFF OC ( Clone )")).toBe("Zotac RTX 5070 Ti SOLID SFF OC");
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

  test("una ficha copiada con (clone) sigue siendo una oferta: sin (clone) y con el MPN estructurado", () => {
    const result = normalizeOffer(
      { ...base, title: "Zotac GAMING GeForce RTX 5070 SOLID OC (clone) [ZT-B50700J-10P]", mpn: "ZT-B50700J-10A" },
      "gpu",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offer.title).not.toMatch(/clone/i);
    expect(result.offer.mpn).toBe("ZTB50700J10A");
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
    ["ssd", "Tarjeta MicroSD Kingston Canvas Go Plus 256GB", "category:other_product"],
    ["case_fan", "Ventilador CPU Morpheus TJ400 ARGB", "category:cpu_cooler"],
    ["case_fan", "Refrigeración líquida MSI MAG CoreLiquid 360R", "category:cpu_cooler"],
    ["cpu_cooler", "Pasta Térmica CoolerMaster Cryofuze 5", "category:other_product"],
    ["case", "Gabinete Casecom CM-01 ATX (caja mala)", "condition:not_new"],
    ["ram", "Pack de Memoria RAM + Disco SSD Kingston 16GB DDR4", "bundle"],
  ] as const)("cuarentena en %s: %s → %s", (category, title, reason) => {
    const result = normalizeOffer({ ...base, category, title, priceCash: 49_990, priceCard: null }, category);
    expect(result).toMatchObject({ ok: false, reason });
  });

  test("en RAM y SSD, mencionar notebook o laptop es compatibilidad, no otro producto", () => {
    const valid = (category: "ram" | "ssd", title: string) =>
      normalizeOffer({ ...base, category, title, priceCash: 59_990, priceCard: null }, category).ok;
    expect(valid("ssd", "SSD WD Green SN3000 2TB M.2 NVMe para PC y Laptop")).toBe(true);
    expect(valid("ram", "ADATA Memoria RAM SODIMM 16GB 3200 DDR4 Laptop/Notebook")).toBe(true);
    expect(valid("ram", "Notebook HP 15 Intel Core i5 16GB DDR4")).toBe(false);
  });

  test("seminuevo es usado", () => {
    const result = normalizeOffer(
      { ...base, title: "Tarjeta de Video ASUS Dual RTX 4070 SUPER 12GB [Seminuevo]" },
      "gpu",
    );
    expect(result).toMatchObject({ ok: false, reason: "condition:not_new" });
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
    [{ title: "Soporte anti-sag para tarjeta de video" }, "category:other_product"],
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

describe("categorías contaminadas", () => {
  const as = (category: RawOffer["category"], title: string) =>
    normalizeOffer({ ...base, category, title, mpn: null, priceCash: 30_000, priceCard: 30_000 }, category);
  const reason = (category: RawOffer["category"], title: string) => {
    const r = as(category, title);
    return r.ok ? "ok" : r.reason;
  };

  test("accesorios van a cuarentena en cualquier categoría", () => {
    expect(reason("case", "Plataforma Giratoria Luminosa Cougar FV270 - Black")).toBe("category:other_product");
    expect(reason("case", "SOPORTE PARA AUDIFONOS GEM")).toBe("category:other_product");
    expect(reason("case", "KIT DE CABLES COOLER MASTER")).toBe("category:other_product");
    expect(reason("cpu_cooler", "PASTA DISIPADORA ARCTIC COOLING MX-4 4G")).toBe("category:other_product");
    expect(reason("cpu_cooler", "THERMAL PAD 100X100 2.0MM")).toBe("category:other_product");
    expect(reason("case_fan", "Cable Splitter ARGB 3 vias")).toBe("category:other_product");
  });

  test.each([
    ["case_fan", "Cooler Master-Cable divisor de ventilador RGB 1 a 3"],
    ["case_fan", "COOLER MASTER ARGB 1 TO 5 SPLITTER"],
    ["cpu_cooler", "CoolerMaster Adaptador para disipador por aire LGA1700"],
    ["cpu_cooler", "FUNDA DE TUBO ENFRIADOR COOLER MASTER LED TUBE"],
    ["ssd", "Disipador de Calor para SSD M.2 HIKSEMI"],
    ["case_fan", "Unidad de Ventilación Nexxt NPF-12WMB para Montaje en Rack"],
    ["case_fan", "Termostato Linkmade RAS-1L"],
    ["cpu_cooler", "CoolerMaster Adaptador WaterCooling LGA1700"],
    ["cpu_cooler", "Disipador Aluminio M.2 Hiksemi Cooler MH1 (NVMe 2280, PS5/PC)"],
    ["cpu_cooler", "NEXXT - Bandeja de Ventiladores para Rack Nexxt Solutions Infrastructure 1U 4 Fan"],
  ] as const)("accesorio en cualquier posición del título (%s): %s", (category, title) => {
    expect(reason(category, title)).toBe("category:other_product");
  });

  test("fuentes publicadas como gabinete, SSD como disco duro y coolers de CPU como ventilador", () => {
    expect(reason("case", "FUENTE DE PODER GAMEMAX GP-650B 650W 80 PLUS BRONZE")).toBe("category:psu");
    expect(reason("case", "EVGA SUPERNOVA 1000 P3 1000W 80 PLUS PLATINUM")).toBe("category:psu");
    expect(reason("case", "Gabinete Nexxt Solutions de 19″, 600×1000, 42U, SKD, 4 ventiladores, Negro")).toBe(
      "category:other_product",
    );
    expect(reason("case", 'Gabinete de Rack Nexxt Solutions NPC-F9U66B 19" 9U 600x600mm 2 Ventiladores')).toBe(
      "category:other_product",
    );
    expect(reason("hdd", "DISCO SSD SATA ADATA SU650 1TB")).toBe("category:ssd");
    expect(reason("ssd", "Disco Duro Seagate Ultrastar 7K6000 4TB")).toBe("category:hdd");
    expect(reason("ssd", "Disco WD Purple 4TB 5400 RPM")).toBe("category:hdd");
    expect(reason("ssd", "Disco 1.2TB 10K RPM SAS 12GBPS 512N 2.5IN HOT R650-R450")).toBe("category:hdd");
    expect(reason("ssd", "Disco Server 1TB SATA 7.2K LFF RW HDD (ML30/MicroServer)")).toBe("category:hdd");
    expect(reason("ssd", 'Lenovo ThinkSystem 1.92 TB hot-swap 2.5" SAS')).not.toBe("category:hdd");
    expect(reason("ssd", "SSD WD Blue SN580 1TB NVMe")).not.toBe("category:hdd");
    expect(reason("case_fan", "Cougar Single Tower Air Cooler FORZA 50")).toBe("category:cpu_cooler");
  });

  test("packs con '+' son combos", () => {
    expect(reason("cpu", "Pack AMD Ryzen 5 5500 + MSI A520-A PRO")).toBe("bundle");
  });

  test("productos reales que se parecen a un accesorio siguen entrando", () => {
    expect(reason("case", "Gabinete Gamer Antec NX200 ATX – Soporte GPU 350 mm")).toBe("ok");
    expect(reason("case", "GABINETE GAMEMAX VISTA AW 6 FAN HUB V4.0")).toBe("ok");
    expect(reason("case", "Gabinete Xtech + Fuente 600W (AT880W)")).toBe("ok");
    expect(reason("case", "Xtech Micro ATX 600W USB 2,0")).toBe("ok");
    expect(reason("cpu_cooler", "Disipador CPU Intel Original con pasta térmica")).toBe("ok");
    expect(reason("case_fan", "KIT GAMEMAX KF300WH ARGB (INCLUYE HUB)")).toBe("ok");
    expect(reason("case_fan", "Ventilador ARGB 120mm para gabinete Mid Tower")).toBe("ok");
    expect(reason("case_fan", "Ventilador 140mm torre gamer")).toBe("ok");
    expect(reason("ssd", "SSD Kingston Fury Renegade 1TB NVMe M.2 con disipador")).toBe("ok");
    expect(reason("case_fan", "Ventilador Gabinete 140mm ARCTIC P14 SLIM PWM PST con Cable Splitter")).toBe("ok");
    expect(reason("case_fan", "Ventilador Gabinete 140mm ARCTIC P14 PWM PST, con Splitter")).toBe("ok");
    expect(reason("case", "Gabinete Clio Rackmount 2U RY2U350-ATX (MicroATX/ITX, 2 Ventiladores, Negro)")).toBe("ok");
    expect(reason("cpu_cooler", "Refrigeración Líquida Asetek Serie 6 240mm (624S-M2) sin bracket AMD/Intel")).toBe(
      "ok",
    );
    expect(reason("cpu_cooler", "Cooler CPU Noctua NH-D15 con adaptador LGA1700")).toBe("ok");
  });

  test.each([
    ["gpu", "Tarjeta gráfica PNY NVIDIA RTX A1000 de 8GB GDDR6"],
    ["gpu", "Tarjeta de Video Gigabyte 1660 SUPER OC 6G"],
    ["gpu", "Tarjeta de Video ASRock Intel Arc Pro B60 Creator 24GB GDDR6"],
    ["motherboard", "Placa Madre Gigabyte TRX50 AERO D (sTR5, DDR5 4400/7800MHz, M.2 x4, E-ATX)"],
    ["cpu", "Procesador para Servidor Lenovo AMD EPYC 7282, 2.8GHz, 16 Núcleos 32 Hilos, 64 MB caché"],
    ["cpu", "PROCESADOR AMD R5-5600GT 3.60GHz AM4"],
  ] as const)("un título que la regex no entiende pasa a Haiku, no a cuarentena (%s): %s", (category, title) => {
    const r = normalizeOffer({ ...base, category, title, mpn: null, priceCash: 300_000, priceCard: 300_000 }, category);
    expect(r.ok ? "ok" : r.reason).toBe("ok");
  });
});

describe("identificadores del título", () => {
  test("llenan el MPN que la tienda no publica", () => {
    const r = normalizeOffer(
      {
        ...base,
        category: "ram",
        brand: "Corsair",
        mpn: null,
        title: "Memoria RAM DIMM 16 GB DDR5 6000 MT/s - Corsair Vengeance (CMK16GX5M1D6000Z38)",
      },
      "ram",
    );
    expect(r.ok && r.offer.mpn).toBe("CMK16GX5M1D6000Z38");
  });

  test("el MPN publicado por la tienda gana al del título", () => {
    const r = normalizeOffer({ ...base, title: `${base.title} [DUAL-RTX4070S-12G]` }, "gpu");
    expect(r.ok && r.offer.mpn).toBe("DUALRTX4070SO12G");
  });
});

describe("clipSourceText", () => {
  const prose = "Lleva tu setup al siguiente nivel. ".repeat(60);
  const specs = `Especificaciones\n${"Tamaño: 120 mm\n".repeat(150)}`;

  test("una ficha que cabe queda igual", () => {
    expect(clipSourceText("Tamaño: 120 mm")).toBe("Tamaño: 120 mm");
  });

  test("larga y con sección de especificaciones: empieza en la sección", () => {
    expect(clipSourceText(prose + specs)).toBe(specs);
    expect(clipSourceText(prose + specs + specs)).toHaveLength(SOURCE_TEXT_MAX);
  });

  test("un 'ver especificaciones' al final no se lleva la ficha", () => {
    const text = `${prose}${prose}Ver especificaciones en el sitio del fabricante.`;
    expect(clipSourceText(text)).toBe(text.slice(0, SOURCE_TEXT_MAX));
  });
});

describe("teclados y mouses", () => {
  const as = (category: RawOffer["category"], title: string) =>
    normalizeOffer({ ...base, category, title, mpn: null, priceCash: 30_000, priceCard: 30_000 }, category);
  const reason = (category: RawOffer["category"], title: string) => {
    const r = as(category, title);
    return r.ok ? "ok" : r.reason;
  };

  test.each([
    ["mouse", "Mouse Inalámbrico Logitech M170 con receptor USB"],
    ["mouse", "Mouse Gamer Redragon Cobra M711 RGB para Laptop y PC"],
    ["keyboard", "Teclado Mecánico Redragon Kumara K552 con Hub USB"],
    ["keyboard", "Teclado Gamer Logitech G413 con reposamuñecas"],
  ] as const)("%s legítimo pasa: %s", (category, title) => {
    expect(reason(category, title)).toBe("ok");
  });

  test.each([
    ["mouse", "Mousepad Gamer Razer Goliathus XL", "category:other_product"],
    ["mouse", "Audífonos Gamer HyperX Cloud Stinger", "category:other_product"],
    ["mouse", "Webcam Logitech C920", "category:other_product"],
    ["keyboard", "Set de Keycaps PBT 104 teclas", "category:other_product"],
    ["keyboard", "Reposamuñecas Teclado Mecánico", "category:other_product"],
    ["keyboard", "Mouse Logitech G502 Hero", "category:mouse"],
    ["mouse", "Teclado Mecánico Logitech G Pro", "category:keyboard"],
  ] as const)("%s mal ubicado: %s", (category, title, expected) => {
    expect(reason(category, title)).toBe(expected);
  });

  test("combos de teclado y mouse van a cuarentena como bundle, digan o no 'combo'", () => {
    expect(reason("keyboard", "Combo Teclado y Mouse Inalámbrico Logitech MK270")).toBe("bundle");
    expect(reason("keyboard", "Teclado + Mouse Gamer Redragon S101")).toBe("bundle");
    expect(reason("mouse", "Mouse y Teclado Inalámbrico HP")).toBe("bundle");
  });

  test("rango de precio", () => {
    expect(reason("mouse", "Mouse Logitech M90")).toBe("ok");
    const cheap = normalizeOffer(
      { ...base, category: "mouse", title: "Mouse Logitech M90", mpn: null, priceCash: 500, priceCard: 500 },
      "mouse",
    );
    expect(cheap).toMatchObject({ ok: false, reason: "price:out_of_range" });
  });
});
