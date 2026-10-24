import type { Category } from "@framerate/contracts";
import { htmlLines } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { fichaText, refreshByPage } from "./html";

/**
 * PrestaShop 1.7+/8: el listado de categoría (`/68-tarjeta-de-video?page=N`) devuelve JSON con `products[]` y
 * `pagination` si la petición trae `X-Requested-With: XMLHttpRequest` (es la llamada AJAX de su paginador).
 * PrestaShop 1.6 no tiene ese JSON. El listado no trae la descripción (`description_short` es el nombre o el bloque de
 * despacho): sale del quickview AJAX, una petición por ficha.
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
  now?: () => number;
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

const QuickviewSchema = z.object({ product: z.object({ description: z.string().nullish() }) });
const QuickviewProductSchema = z.object({ product: ProductSchema });

const MAX_PAGES = 50;

/** Un listado o quickview que llega como HTML (mantenimiento, anti-bot, ruta cambiada) se dice así y no como error de JSON.parse (#220). */
function notHtml(text: string, url: string): string {
  if (text.trimStart().startsWith("<")) throw new Error(`${url} devolvió HTML en vez de JSON`);
  return text;
}

export function createPrestaShopAdapter(config: PrestaShopConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      for (const path of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const url = `${config.baseUrl}/${path}?page=${page}`;
          const res = await ctx.http.get(url, { headers: { "X-Requested-With": "XMLHttpRequest" } });
          await ctx.snapshot(`${path}/page-${page}.json`, res.text);

          const { products, pagination } = PageSchema.parse(JSON.parse(notHtml(res.text, url)));
          ctx.log.info("prestashop.page", { path, page, items: products.length, pages: pagination.pages_count });
          for (const raw of products) {
            const product = ProductSchema.safeParse(raw);
            if (!product.success) {
              yield raw as RawOffer;
              continue;
            }
            const offer = toRawOffer(product.data, category, config);
            const now = (config.now ?? Date.now)();
            offer.sourceText = await fichaText(ctx, offer, now, () => quickview(ctx, config.baseUrl, offer.externalId));
            yield offer;
          }

          if (products.length === 0 || page >= pagination.pages_count) break;
        }
      }
    },
    // El quickview trae el mismo producto que el listado (precio, `add_to_cart_url`): una petición por oferta.
    refreshOffers: (refs, ctx) =>
      refreshByPage(
        refs,
        ctx,
        (text, ref) => {
          const product = QuickviewProductSchema.safeParse(JSON.parse(text));
          return product.success ? toRawOffer(product.data.product, ref.category, config) : null;
        },
        (ref) => postQuickview(ctx, config.baseUrl, ref.externalId),
      ),
  };
}

async function postQuickview(ctx: CrawlContext, baseUrl: string, id: string): Promise<string> {
  const url = `${baseUrl}/index.php?controller=product`;
  // Sin X-Requested-With: el relay no lo reenvía y las cuatro tiendas responden igual.
  const res = await ctx.http.post(
    url,
    `action=quickview&id_product=${encodeURIComponent(id)}&id_product_attribute=0&ajax=1`,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return notHtml(res.text, url);
}

async function quickview(ctx: CrawlContext, baseUrl: string, id: string): Promise<string | null> {
  const parsed = QuickviewSchema.safeParse(JSON.parse(await postQuickview(ctx, baseUrl, id)));
  return (parsed.success && htmlLines(parsed.data.product.description ?? "")) || null;
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
