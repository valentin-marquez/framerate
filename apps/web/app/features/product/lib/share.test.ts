import { describe, expect, test } from "bun:test";
import type { ProductDetail } from "@framerate/contracts";
import { byteLength, DISCORD_EMBED_MAX_BYTES, discordEmbed, ogImagePath, shareDescription } from "./share";

const offer = (slug: string, priceCash: number, inStock = true, priceCard = Math.round(priceCash * 1.05)) => ({
  id: priceCash,
  store: { slug, name: slug.toUpperCase(), url: `https://${slug}.cl`, iconUrl: null },
  url: `https://${slug}.cl/p/1`,
  title: "x",
  priceCash,
  priceCard,
  inStock,
  stockQuantity: null,
  lastSeenAt: "2026-10-10T00:00:00.000Z",
});

const product = (patch: Partial<ProductDetail> = {}) =>
  ({
    id: 1,
    slug: "msi-a520m-a-pro",
    name: "MSI A520M-A PRO",
    brand: "MSI",
    category: "motherboard",
    imageUrl: "https://cdn.framerate.cl/products/a.webp",
    bestPrice: 46_900,
    offerCount: 4,
    offers: [
      offer("pcexpress", 46_900),
      offer("pcexpress", 47_000),
      offer("winpy", 48_990),
      offer("sp", 40_000, false),
    ],
    specs: [],
    variants: [],
    ...patch,
  }) as unknown as ProductDetail;

const texts = (embed: unknown) => JSON.stringify(embed);

describe("tarjeta de Discord", () => {
  test("contenedor único con foto, mejor precio, tiendas con stock (una por tienda) y botones", () => {
    const embed = discordEmbed(product(), "https://framerate.cl");
    const container = embed.component as { type: number; components: { type: number }[] };
    expect(container.type).toBe(17);
    expect(container.components.map((c) => c.type)).toEqual([9, 14, 10, 1]);
    const json = texts(embed);
    expect(json).toContain("Placa madre de MSI");
    expect(json).toContain("$46.900");
    expect(json).toContain("con tarjeta");
    expect(json).toContain("**PCEXPRESS** $46.900");
    expect(json).toContain("**WINPY** $48.990");
    expect(json).not.toContain("SP**");
    expect(json).toContain("Ir a PCEXPRESS");
    expect(json).toContain("https://framerate.cl/producto/msi-a520m-a-pro");
  });

  test("respeta el tope de bytes con nombres largos y muchas tiendas", () => {
    const many = Array.from({ length: 30 }, (_, i) => offer(`tienda-${"x".repeat(40)}-${i}`, 50_000 + i));
    const embed = discordEmbed(product({ name: "N".repeat(250), offers: many }), "https://framerate.cl");
    expect(byteLength(embed)).toBeLessThanOrEqual(DISCORD_EMBED_MAX_BYTES);
    expect(texts(embed)).toContain("tiendas más con stock");
  });

  test("escapa el markdown del nombre para no romper el enlace", () => {
    const json = texts(discordEmbed(product({ name: "Kit [2x8GB] (DDR4)" }), "https://framerate.cl"));
    expect(json).toContain("Kit \\\\[2x8GB\\\\] \\\\(DDR4\\\\)");
  });

  test("sin stock no inventa precio ni botón a una tienda; sin foto va sin miniatura", () => {
    const embed = discordEmbed(
      product({ imageUrl: null, bestPrice: null, offers: [offer("sp", 40_000, false)] }),
      "https://framerate.cl",
    );
    const json = texts(embed);
    expect(json).toContain("Ninguna tienda lo tiene en stock");
    expect(json).not.toContain("Ir a");
    expect(json).not.toContain('"type":11');
  });

  test("sin separadores ni guiones largos en el texto visible", () => {
    for (const p of [product(), product({ bestPrice: null, offers: [] })]) {
      const visible = texts(discordEmbed(p, "https://framerate.cl")) + shareDescription(p);
      expect(visible).not.toMatch(/ · |—|–/);
    }
  });

  test("la imagen para compartir cambia de versión sólo cuando cambia la foto", () => {
    expect(ogImagePath("msi-a520m", "https://cdn.framerate.cl/products/346cab.webp")).toBe(
      "/og/producto/msi-a520m.jpg?v=346cab",
    );
  });
});
