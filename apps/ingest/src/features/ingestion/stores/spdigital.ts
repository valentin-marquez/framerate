import type { Category } from "@framerate/contracts";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { parseClp } from "./html";

/**
 * SP Digital (Gatsby + Saleor). Cada subcategoría se publica dos veces, las dos desde el servidor (sin `render`):
 * `/page-data/categories/<slug>/page-data.json` trae por producto MPN, GTIN, marca, condición, stock y el precio
 * "otros medios de pago"; el HTML `/categories/<slug>/` trae las tarjetas con el precio de transferencia, que el JSON
 * no tiene cuando el producto está en oferta (ahí `metadata.pricing` guarda el precio de lista). El listado sólo
 * incluye lo que tiene stock. `robots.txt` pide `Crawl-delay: 5`. Se descartan caja abierta y segunda selección.
 */

export interface SpDigitalConfig {
  baseUrl: string;
  /** Categoría Framerate → slugs de subcategoría de la tienda ("componentes-tarjeta-de-video-tarjeta-video-nvidia"). */
  categories: Partial<Record<Category, readonly string[]>>;
}

const MAX_PAGES = 10;

const ItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  metadata: z.array(z.object({ key: z.string(), value: z.string() })),
  attributes: z.array(
    z.object({ attribute: z.object({ slug: z.string() }), values: z.array(z.object({ name: z.string() })) }),
  ),
  pricing: z.object({ priceRange: z.object({ start: z.object({ gross: z.object({ amount: z.number() }) }) }) }),
  defaultVariant: z.object({ sku: z.string(), quantityAvailable: z.number() }),
  media: z.array(z.object({ url: z.string() })),
});
type Item = z.infer<typeof ItemSchema>;

const PageSchema = z.object({
  result: z.object({
    pageContext: z.object({
      content: z.object({ items: z.array(z.unknown()) }),
      defaultTotalPages: z.number().default(1),
    }),
  }),
});

export function createSpDigitalAdapter(config: SpDigitalConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      for (const slug of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const suffix = page > 1 ? `${page}/` : "";
          const json = await ctx.http.get(`${config.baseUrl}/page-data/categories/${slug}/${suffix}page-data.json`);
          const html = await ctx.http.get(`${config.baseUrl}/categories/${slug}/${suffix}`, { accept: "text/html" });
          await ctx.snapshot(`${slug}/page-${page}.json`, json.text);
          await ctx.snapshot(`${slug}/page-${page}.html`, html.text);

          const data = PageSchema.parse(JSON.parse(json.text)).result.pageContext;
          const cash = cardCashPrices(html.text);
          for (const raw of data.content.items) {
            const item = ItemSchema.parse(raw);
            if (seen.has(item.slug)) continue;
            seen.add(item.slug);
            const offer = toRawOffer(item, cash.get(item.slug), config.baseUrl, category);
            if (offer) yield offer;
            else ctx.log.info("spdigital.omitido", { slug: item.slug });
          }
          ctx.log.info("spdigital.page", {
            slug,
            page,
            items: data.content.items.length,
            pages: data.defaultTotalPages,
          });
          if (page >= data.defaultTotalPages) break;
        }
      }
    },
  };
}

/** Precio "Transferencias" de cada tarjeta del listado, por slug. */
export function cardCashPrices(html: string): Map<string, number> {
  const prices = new Map<string, number>();
  for (const block of html.split('n:productcard|v:default"').slice(1)) {
    const slug = block.match(/href="\/([^"?/]+)\/"/)?.[1];
    const cash = parseClp(block.match(/>(\$[\d.]+)<\/span><span[^>]*>Transferencias</)?.[1]);
    if (slug && cash) prices.set(slug, cash);
  }
  return prices;
}

const attr = (item: Item, slug: string) =>
  item.attributes.find((a) => a.attribute.slug === slug)?.values[0]?.name.trim() || null;

/** `null` si el producto no es nuevo o no tiene precio de transferencia (el listado y las tarjetas no coinciden). */
export function toRawOffer(
  item: Item,
  priceCash: number | undefined,
  baseUrl: string,
  category: Category,
): RawOffer | null {
  const condition = attr(item, "condition");
  if (!priceCash || (condition && condition !== "Nuevo")) return null;
  const meta = Object.fromEntries(item.metadata.map((m) => [m.key, m.value.trim()]));
  const units = item.defaultVariant.quantityAvailable;
  return {
    // El `sku` ("NA0000099995") es interno; el MPN del fabricante viaja aparte.
    externalId: item.defaultVariant.sku,
    url: `${baseUrl}/${item.slug}/`,
    title: item.name.trim(),
    category,
    priceCash,
    priceCard: item.pricing.priceRange.start.gross.amount,
    inStock: units > 0,
    stockQuantity: Math.max(units, 0),
    brand: attr(item, "brand"),
    mpn: meta.mpn || null,
    gtin: meta.gtin || null,
    imageUrls: item.media.map((m) => m.url),
  };
}
