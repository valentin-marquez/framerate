import type { Category } from "@framerate/contracts";
import { decodeEntities } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { getPage, parseClp } from "./html";

/**
 * AllTec (PrestaShop 1.6, sin JSON). El listado va de a 50 (`?n=` sólo acepta sus valores fijos) y no trae referencia
 * ni stock en unidades: se entra a cada ficha. Ficha: `itemprop="sku"` es el MPN, `quantityAvailable` el stock y
 * "por PAGO DEBITO / CREDITO / WEBPAY" el precio tarjeta (transferencia +3,5 %). Sin marca: la saca normalize del título.
 */

export interface AlltecConfig {
  baseUrl: string;
  /** Categoría Framerate → ruta de subcategoría ("64-nvidia"). Las categorías padre están vacías o traen accesorios. */
  categories: Partial<Record<Category, readonly string[]>>;
}

const MAX_PAGES = 20;
const CARD_MARKUP = 0.035;

const LIST_ITEM = /class="product_img_link" href="([^"]*\/(\d+)-[^"]*)"/g;

export function createAlltecAdapter(config: AlltecConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      for (const path of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const listUrl = `${config.baseUrl}/${path}`;
          const res = await ctx.http.get(page > 1 ? `${listUrl}?p=${page}` : listUrl, { accept: "text/html" });
          await ctx.snapshot(`${path}/page-${page}.html`, res.text);

          const items = [...res.text.matchAll(LIST_ITEM)];
          // "Mostrando 1 - 50 de 59"
          const [, shown = "0", total = "0"] = res.text.match(/Mostrando \d+ - (\d+) de (\d+)/) ?? [];
          ctx.log.info("alltec.page", { path, page, items: items.length, total: Number(total) });
          for (const [, href = "", id = ""] of items) {
            if (seen.has(id)) continue;
            seen.add(id);
            const url = decodeEntities(href);
            const html = await getPage(ctx, url);
            if (!html) continue;
            await ctx.snapshot(`product-${id}.html`, html);
            yield toRawOffer(html, id, url, category);
          }

          if (items.length === 0 || Number(shown) >= Number(total)) break;
        }
      }
    },
  };
}

export function toRawOffer(html: string, id: string, url: string, category: Category): RawOffer {
  const sku = decodeEntities(html.match(/itemprop="sku" content="([^"]*)"/)?.[1] ?? "").trim();
  const gtin = normalizeGtin(sku) ? sku : null;
  // El texto, no `content`: a veces trae decimales ("799900.000001").
  const priceCash = parseClp(html.match(/id="our_price_display"[^>]*>([^<]*)/)?.[1]) ?? 0;
  const units = Number(html.match(/var quantityAvailable=(\d+)/)?.[1] ?? 0);
  const image = html.match(/id="bigpic"[^>]*src="([^"]+)"/)?.[1];

  return {
    externalId: id,
    url,
    title: decodeEntities(html.match(/<h1 itemprop="name">([^<]*)/)?.[1] ?? "").trim(),
    category,
    priceCash,
    priceCard:
      parseClp(html.match(/id="unit_price_display">([^<]*)<\/span> por PAGO/)?.[1]) ??
      Math.floor(priceCash * (1 + CARD_MARKUP)),
    inStock: units > 0,
    stockQuantity: units,
    brand: null,
    mpn: gtin ? null : sku || null,
    gtin,
    imageUrls: image ? [image] : [],
  };
}
