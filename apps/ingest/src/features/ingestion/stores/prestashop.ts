import type { Category } from "@framerate/contracts";
import { normalizeGtin } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";

/**
 * PrestaShop 1.7+/8: el listado de categoría (`/68-tarjeta-de-video?page=N`) devuelve JSON con `products[]` y
 * `pagination` si la petición trae `X-Requested-With: XMLHttpRequest` (es la llamada AJAX de su paginador).
 * PrestaShop 1.6 no tiene ese JSON.
 */

export interface PrestaShopConfig {
  /** Raíz de la tienda, con subruta si la tiene ("https://tienda.cl/tienda"). */
  baseUrl: string;
  /** Categoría Framerate → ruta del listado ("68-tarjeta-de-video", "procesadores-450"). Incluye subcategorías. */
  categories: Partial<Record<Category, readonly string[]>>;
  /** Qué es `reference` en ESTA tienda. Una referencia que sea un GTIN válido se usa como GTIN en ambos casos. */
  reference: "mpn" | "internal";
  /** `price_amount` es la transferencia y la tarjeta lleva este recargo (0.05 = +5 %). */
  cardMarkup?: number;
  /** `price_amount` es la tarjeta y la transferencia tiene este descuento (0.05 = −5 %). */
  cashDiscount?: number;
}

const PageSchema = z.object({
  products: z.array(z.unknown()),
  pagination: z.object({ pages_count: z.number() }),
});

const ProductSchema = z.object({
  id_product: z.coerce.string(),
  name: z.string(),
  url: z.url(),
  reference: z.string().nullable().default(""),
  manufacturer_name: z.string().nullable().optional(),
  price_amount: z.number(),
  // PrestaShop lo deja en null cuando no se puede comprar (sin stock y sin venta bajo pedido). El JSON no trae cantidad.
  add_to_cart_url: z.string().nullable(),
  cover: z.object({ large: z.object({ url: z.url() }) }).nullish(),
});
type PrestaShopProduct = z.infer<typeof ProductSchema>;

const MAX_PAGES = 50;

export function createPrestaShopAdapter(config: PrestaShopConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      for (const path of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await ctx.http.get(`${config.baseUrl}/${path}?page=${page}`, {
            headers: { "X-Requested-With": "XMLHttpRequest" },
          });
          await ctx.snapshot(`${path}/page-${page}.json`, res.text);

          const { products, pagination } = PageSchema.parse(JSON.parse(res.text));
          ctx.log.info("prestashop.page", { path, page, items: products.length, pages: pagination.pages_count });
          for (const raw of products) {
            const product = ProductSchema.safeParse(raw);
            yield product.success ? toRawOffer(product.data, category, config) : (raw as RawOffer);
          }

          if (products.length === 0 || page >= pagination.pages_count) break;
        }
      }
    },
  };
}

export function toRawOffer(
  p: PrestaShopProduct,
  category: Category,
  config: Pick<PrestaShopConfig, "reference" | "cardMarkup" | "cashDiscount">,
): RawOffer {
  const listed = Math.round(p.price_amount);
  const reference = p.reference?.trim() ?? "";
  const gtin = normalizeGtin(reference) ? reference : null;
  const inStock = p.add_to_cart_url !== null;

  return {
    externalId: p.id_product,
    url: p.url,
    title: p.name,
    category,
    // La ficha muestra el descuento ya redondeado y lo resta ("$ 1.250 descuento" sobre $ 24.990 en MyBox).
    priceCash: config.cashDiscount ? listed - Math.round(listed * config.cashDiscount) : listed,
    priceCard: config.cashDiscount ? listed : config.cardMarkup ? Math.round(listed * (1 + config.cardMarkup)) : null,
    inStock,
    stockQuantity: inStock ? null : 0,
    brand: p.manufacturer_name?.trim() || null,
    mpn: !gtin && config.reference === "mpn" && reference ? reference : null,
    gtin,
    imageUrls: p.cover ? [p.cover.large.url] : [],
  };
}
