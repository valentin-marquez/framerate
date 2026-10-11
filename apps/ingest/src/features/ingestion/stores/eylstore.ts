import type { Category } from "@framerate/contracts";
import { normalizeGtin } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";

/**
 * Eylstore (Next.js sobre una API Laravel). `GET /api/categorias/<slug>/productos?per_page=100` trae marca, código,
 * part number, los dos precios y el stock: no hace falta la ficha. Su robots.txt prohíbe `/api`; se usa igual por
 * decisión del dueño (11-10-2026). El código es el MPN sólo a veces ("SKU no informado" o un número interno el resto).
 */

export interface EylstoreConfig {
  baseUrl: string;
  /** Categoría Framerate → slug de categoría de la tienda. */
  categories: Partial<Record<Category, readonly string[]>>;
}

const MAX_PAGES = 10;

const ProductSchema = z.object({
  slug: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  code: z.string().nullable(),
  part_number: z.string().nullable(),
  stock: z.number(),
  precio_transferencia: z.number(),
  precio_tarjeta: z.number().nullable(),
  image: z.string().nullable(),
  gallery: z.array(z.string()).default([]),
});
const PageSchema = z.object({
  meta: z.object({ last_page: z.number() }),
  products: z.array(z.unknown()),
});

export function createEylstoreAdapter(config: EylstoreConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      for (const slug of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await ctx.http.get(
            `${config.baseUrl}/api/categorias/${slug}/productos?per_page=100&page=${page}`,
          );
          await ctx.snapshot(`${slug}/page-${page}.json`, res.text);

          const { meta, products } = PageSchema.parse(JSON.parse(res.text));
          ctx.log.info("eylstore.page", { slug, page, items: products.length, pages: meta.last_page });
          for (const item of products) {
            const product = ProductSchema.safeParse(item);
            // Un item mal formado no tumba la página: `normalize` lo manda a cuarentena con su motivo.
            const offer = product.success ? toRawOffer(product.data, config.baseUrl, category) : (item as RawOffer);
            if (seen.has(offer.externalId)) continue;
            seen.add(offer.externalId);
            yield offer;
          }
          if (products.length === 0 || page >= meta.last_page) break;
        }
      }
    },
  };
}

// "SKU no informado", un número interno ("2417") o un modelo con espacios ("B550M K") no son MPN.
const isMpn = (code: string) => /^\S+$/.test(code) && /[a-z]/i.test(code) && /\d/.test(code);

export function toRawOffer(p: z.infer<typeof ProductSchema>, baseUrl: string, category: Category): RawOffer {
  const code = p.code?.trim() ?? "";
  const gtin = normalizeGtin(code) ? code : null;
  const mpn = [p.part_number?.trim() ?? "", code].find((c) => !gtin && isMpn(c)) ?? null;
  return {
    externalId: p.slug,
    url: `${baseUrl}/producto/${p.slug}`,
    title: p.name.trim(),
    category,
    priceCash: p.precio_transferencia,
    priceCard: p.precio_tarjeta,
    inStock: p.stock > 0,
    stockQuantity: p.stock,
    brand: p.brand?.trim() || null,
    mpn,
    gtin,
    imageUrls: [...new Set([p.image, ...p.gallery].filter((s): s is string => !!s))],
  };
}
