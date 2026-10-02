import { describe, expect, test } from "bun:test";
import type { CategoryItem, ProductDetail, ProductPage } from "@framerate/contracts";
import { categoryMarkdown, homeMarkdown, prefersMarkdown, productMarkdown } from "./markdown";

const ORIGIN = "https://framerate.cl";

describe("prefersMarkdown", () => {
  test("sólo cuando text/markdown le gana a text/html", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
  });

  test("un navegador, */* o sin cabecera siguen recibiendo HTML", () => {
    expect(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(false);
    expect(prefersMarkdown("*/*")).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
  });
});

const product = {
  slug: "asus-dual-rtx-4070-super",
  name: "ASUS Dual RTX 4070 SUPER",
  brand: "ASUS",
  category: "gpu",
  mpn: "DUAL-4070S",
  bestPrice: 599_990,
  bestCardPrice: 619_990,
  offerCount: 2,
  offers: [
    {
      store: { slug: "beta", name: "Beta", url: "https://beta.cl" },
      url: "https://beta.cl/p/1",
      priceCash: 599_990,
      priceCard: 619_990,
      inStock: true,
    },
    {
      store: { slug: "alfa", name: "Alfa", url: "https://alfa.cl" },
      url: "https://alfa.cl/p/2",
      priceCash: 650_000,
      priceCard: 650_000,
      inStock: false,
    },
  ],
} as unknown as ProductDetail;

describe("productMarkdown", () => {
  test("nombre, mejor precio y una línea por tienda con su stock", () => {
    const md = productMarkdown(product, ORIGIN);
    expect(md).toContain("# ASUS Dual RTX 4070 SUPER");
    expect(md).toContain(`${ORIGIN}/producto/asus-dual-rtx-4070-super`);
    expect(md).toMatch(/Mejor precio.*599\.990/);
    expect(md).toMatch(/\[Beta\]\(https:\/\/beta\.cl\/p\/1\).*599\.990.*619\.990.*en stock/);
    expect(md).toMatch(/\[Alfa\]\(https:\/\/alfa\.cl\/p\/2\).*sin stock/);
  });

  test("sin stock en ninguna tienda no inventa un mejor precio", () => {
    const md = productMarkdown({ ...product, bestPrice: null, bestCardPrice: null } as ProductDetail, ORIGIN);
    expect(md).toContain("Sin stock");
    expect(md).not.toMatch(/Mejor precio/);
  });
});

describe("categoryMarkdown y homeMarkdown", () => {
  test("lista los productos con su precio y enlaza a la página completa", () => {
    const page = {
      items: [{ slug: "a", name: "Producto A", brand: null, bestPrice: 10_000, bestCardPrice: 11_000 }],
      page: 1,
      pageSize: 24,
      total: 40,
    } as unknown as ProductPage;
    const md = categoryMarkdown("Tarjetas de video", "tarjetas-de-video", page, ORIGIN);
    expect(md).toContain("# Tarjetas de video");
    expect(md).toContain(`[Producto A](${ORIGIN}/producto/a)`);
    expect(md).toContain("40");
    expect(md).toContain(`${ORIGIN}/categoria/tarjetas-de-video`);
  });

  test("la home lista las categorías con su cantidad", () => {
    const categories = [
      { id: "gpu", slug: "tarjetas-de-video", label: "Tarjetas de video", productCount: 120 },
    ] as CategoryItem[];
    const md = homeMarkdown(categories, ORIGIN);
    expect(md).toContain("# Framerate");
    expect(md).toContain(`[Tarjetas de video](${ORIGIN}/categoria/tarjetas-de-video)`);
    expect(md).toContain("120");
  });
});
