import type { Category } from "@framerate/contracts";
import { stripHtml } from "@framerate/kit";
import { codesInTitle, normalizeGtin, normalizeMpn } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";

/**
 * Adaptador genérico para tiendas WooCommerce vía Store API pública
 * (`/wp-json/wc/store/v1/products`). JSON estable, sin navegador: es la vía
 * preferida siempre que la tienda la tenga habilitada.
 */

export interface WooCommerceConfig {
  baseUrl: string;
  /** Categoría Framerate → slugs de categoría de la tienda. */
  categories: Partial<Record<Category, readonly string[]>>;
  /**
   * Qué significa el campo `sku` en ESTA tienda:
   *  - "mpn": código del fabricante (verificado a mano contra la tienda).
   *  - "internal": código propio de la tienda, no sirve para matching.
   * Un SKU que sea un GTIN válido (checksum) se usa como GTIN en ambos casos.
   */
  sku: "mpn" | "internal";
  /**
   * Recargo del precio con tarjeta sobre el de transferencia (0.07 = +7 %), verificado en la ficha de la tienda.
   * La Store API no trae el precio tarjeta: `regular_price` suele ser el precio "antes" tachado. Sin recargo,
   * tarjeta = transferencia.
   */
  cardMarkup?: number;
  /** Al revés que `cardMarkup`: `price` es el precio tarjeta y la transferencia tiene este descuento (0.05 = −5 %). */
  cashDiscount?: number;
  /**
   * En esta tienda `regular_price` es el precio con tarjeta, no el "antes" (verificado en la ficha: Tekmachine muestra
   * "Tarjetas" y "Efectivo/Transferencia"). Se usa sólo si es mayor que `price`.
   */
  cardFromRegular?: boolean;
  /** `false`: el SKU nunca es GTIN aunque pase el dígito verificador (Play Factory usa números internos de 14
   * dígitos y ~1 de cada 10 lo pasa por azar). */
  skuGtin?: false;
  /** Pedir el catálogo entero sin `?category=` y repartir por `categories[].slug`: para tiendas cuyo robots.txt
   * prohíbe `/*category=` (Centrale). Cada corrida recorre todas las páginas. */
  wholeCatalog?: boolean;
  /** SKU de productos que no son ofertas reales (Trulu publica las piezas de sus PC armados, `…-PC`, a precio de costo). */
  skipSku?: RegExp;
  perPage?: number;
  /** Tope de páginas por categoría (protección contra loops infinitos). */
  maxPages?: number;
}

/** Sólo los campos que usamos; el resto se ignora. `passthrough` no hace falta. */
const WcProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  permalink: z.url(),
  sku: z.string().optional().default(""),
  description: z.string().optional().default(""),
  is_in_stock: z.boolean(),
  low_stock_remaining: z.number().nullable().optional(),
  prices: z.object({
    price: z.string(),
    regular_price: z.string(),
    sale_price: z.string().optional(),
    currency_code: z.string().optional(),
    currency_minor_unit: z.number().int().min(0).max(4).default(0),
  }),
  images: z.array(z.object({ src: z.url() })).default([]),
  categories: z.array(z.object({ slug: z.string() })).optional(),
  brands: z.array(z.object({ name: z.string() })).optional(),
  attributes: z
    .array(
      z.object({
        name: z.string(),
        taxonomy: z.string().nullable().optional(),
        terms: z.array(z.object({ name: z.string() })).default([]),
      }),
    )
    .default([]),
});
type WcProduct = z.infer<typeof WcProductSchema>;

export function createWooCommerceAdapter(config: WooCommerceConfig): StoreAdapter {
  const perPage = config.perPage ?? 100;
  const maxPages = config.maxPages ?? 50;

  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const slugs = config.categories[category] ?? [];
      for (const slug of config.wholeCatalog ? ["*"] : slugs) {
        for (let page = 1; page <= maxPages; page++) {
          const filter = slug === "*" ? "" : `category=${encodeURIComponent(slug)}&`;
          const url = `${config.baseUrl}/wp-json/wc/store/v1/products?${filter}per_page=${perPage}&page=${page}`;
          const res = await ctx.http.get(url);
          await ctx.snapshot(`${slug}/page-${page}.json`, res.text);

          const items = parseItems(res.text);
          ctx.log.info("woocommerce.page", { slug, page, items: items.length });
          for (const item of items) {
            const product = WcProductSchema.safeParse(item);
            if (slug === "*" && !product.data?.categories?.some((c) => slugs.includes(c.slug))) continue;
            if (config.skipSku && product.data && config.skipSku.test(product.data.sku)) continue;
            // Un item mal formado no debe tumbar la página: se entrega crudo y
            // la validación de `normalize` lo manda a cuarentena con su motivo.
            yield product.success ? toRawOffer(product.data, category, config) : (item as RawOffer);
          }

          const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1");
          if (items.length < perPage || page >= totalPages) break;
        }
      }
    },
  };
}

function parseItems(text: string): unknown[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("WooCommerce Store API: se esperaba un arreglo de productos");
  return data;
}

// Infor-Ingen y ETChile escriben el código del fabricante en la ficha ("P/N: 288-1N754-210Z6 ⚡ Tarjeta…"). Sólo la
// etiqueta explícita: "Modelo" y `short_description` traen nombres, no códigos.
const PART_NUMBER = /\b(?:p\s*\/\s*n|part\s*number|n[uú]mero de parte)\s*[:#]?\s*([A-Za-z0-9][\w\-./]{3,40})/i;

export function toRawOffer(
  p: WcProduct,
  category: Category,
  config: Pick<WooCommerceConfig, "sku" | "cardMarkup" | "cashDiscount" | "cardFromRegular" | "skuGtin">,
): RawOffer {
  const divisor = 10 ** p.prices.currency_minor_unit;
  const toClp = (v: string | undefined) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n > 0 ? Math.round(n / divisor) : null;
  };
  const listed = toClp(p.prices.price) ?? toClp(p.prices.regular_price);
  const price = listed && config.cashDiscount ? Math.round(listed * (1 - config.cashDiscount)) : listed;
  const regular = toClp(p.prices.regular_price);
  const card = config.cashDiscount
    ? listed
    : config.cardFromRegular && price && regular && regular > price
      ? regular
      : price && config.cardMarkup
        ? Math.round(price * (1 + config.cardMarkup))
        : null;
  const sku = p.sku.trim();
  const gtin = config.skuGtin !== false && normalizeGtin(sku) ? sku : null;
  const skuMpn = !gtin && config.sku === "mpn" && sku ? sku : null;
  const skuIsMpn = normalizeMpn(skuMpn) !== null;
  const description = stripHtml(p.description);
  const partNumber = description.match(PART_NUMBER)?.[1];
  const descriptionMpn = gtin || skuIsMpn || !partNumber ? null : codesInTitle(`P/N ${partNumber}`).mpn;

  return {
    externalId: String(p.id),
    url: p.permalink,
    title: stripHtml(p.name),
    category,
    // Un precio inválido (0/NaN) deja un valor que `normalize` rechaza con motivo claro.
    priceCash: price ?? 0,
    priceCard: card,
    inStock: p.is_in_stock,
    stockQuantity: p.is_in_stock ? (p.low_stock_remaining ?? null) : 0,
    brand: p.brands?.[0]?.name ?? brandFromAttributes(p) ?? null,
    mpn: skuIsMpn ? skuMpn : descriptionMpn,
    gtin,
    imageUrls: p.images.map((i) => i.src),
    sourceText: description || null,
  };
}

function brandFromAttributes(p: WcProduct): string | null {
  const attr = p.attributes.find((a) => /marca|brand/i.test(a.taxonomy ?? a.name));
  return attr?.terms[0]?.name ?? null;
}
