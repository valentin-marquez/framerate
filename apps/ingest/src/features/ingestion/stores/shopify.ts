import type { Category } from "@framerate/contracts";
import { stripHtml } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { refreshByListing } from "./html";

/**
 * Tiendas en Shopify: `/collections/<handle>/products.json` trae precio, disponibilidad y SKU, también de los agotados.
 * `compare_at_price` es el precio "antes" tachado: no se usa. El SKU nunca es MPN aquí; si es un GTIN válido, se usa.
 */

export interface ShopifyConfig {
  baseUrl: string;
  /** Categoría Framerate → handles de colección. */
  categories: Partial<Record<Category, readonly string[]>>;
  /** Recargo del precio tarjeta sobre `price` (0.05 = +5 %), verificado en la ficha: el JSON no trae el precio tarjeta. */
  cardMarkup?: number;
}

const ProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  body_html: z.string().nullable().default(""),
  vendor: z.string().nullable().default(null),
  images: z.array(z.object({ src: z.url() })).default([]),
  variants: z
    .array(z.object({ sku: z.string().nullable().default(""), price: z.string(), available: z.boolean() }))
    .min(1),
});
type ShopifyProduct = z.infer<typeof ProductSchema>;

const PageSchema = z.object({ products: z.array(z.unknown()) });

/** El máximo de `limit` en Shopify. */
const PAGE_SIZE = 250;
/** Protección contra loops infinitos. */
const MAX_PAGES = 50;

export function createShopifyAdapter(config: ShopifyConfig): StoreAdapter {
  async function* list(category: Category, ctx: CrawlContext): AsyncIterable<RawOffer> {
    for (const handle of config.categories[category] ?? []) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${config.baseUrl}/collections/${handle}/products.json?limit=${PAGE_SIZE}&page=${page}`;
        const res = await ctx.http.get(url);
        await ctx.snapshot(`${handle}/page-${page}.json`, res.text);
        const { products } = PageSchema.parse(JSON.parse(res.text));
        ctx.log.info("shopify.page", { handle, page, items: products.length });
        for (const item of products) {
          const product = ProductSchema.safeParse(item);
          // Un item mal formado no tumba la página: `normalize` lo manda a cuarentena con su motivo.
          yield product.success ? toRawOffer(product.data, category, config) : (item as RawOffer);
        }
        if (products.length < PAGE_SIZE) break;
      }
    }
  }

  return {
    categories: config.categories,
    crawlCategory: list,
    refreshOffers: (refs, ctx) => refreshByListing(refs, (category) => list(category, ctx)),
  };
}

export function toRawOffer(
  p: ShopifyProduct,
  category: Category,
  config: Pick<ShopifyConfig, "baseUrl" | "cardMarkup">,
): RawOffer {
  const variant = p.variants.find((v) => v.available) ?? (p.variants[0] as ShopifyProduct["variants"][number]);
  const listed = Number(variant.price);
  // Un precio inválido (0/NaN) deja un valor que `normalize` rechaza con motivo claro.
  const price = Number.isFinite(listed) && listed > 0 ? Math.round(listed) : 0;
  const sku = variant.sku?.trim() ?? "";
  return {
    externalId: String(p.id),
    url: `${config.baseUrl}/products/${p.handle}`,
    title: stripHtml(p.title),
    category,
    priceCash: price,
    priceCard: price && config.cardMarkup ? Math.round(price * (1 + config.cardMarkup)) : null,
    inStock: variant.available,
    stockQuantity: variant.available ? null : 0,
    brand: p.vendor,
    mpn: null,
    gtin: normalizeGtin(sku) ? sku : null,
    imageUrls: p.images.map((i) => i.src),
    sourceText: stripHtml(p.body_html ?? "") || null,
  };
}
