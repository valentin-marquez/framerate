import type { Category } from "@framerate/contracts";
import { decodeEntities } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { parseClp } from "./html";

/**
 * Eylstore (Next.js, renderizado en el servidor). El listado `/categorias/<slug>?page=N` (12 por página) trae en cada
 * `<article>` marca, título, código, unidades, "Transferencia" y "Otros medios de pago" (tarjeta): no hace falta la ficha.
 * Su robots.txt prohíbe `/api`. El código es el MPN sólo a veces ("SKU no informado" o un número interno el resto).
 */

export interface EylstoreConfig {
  baseUrl: string;
  /** Categoría Framerate → slug de categoría de la tienda. */
  categories: Partial<Record<Category, readonly string[]>>;
}

const MAX_PAGES = 30;

export function createEylstoreAdapter(config: EylstoreConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      for (const slug of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await ctx.http.get(`${config.baseUrl}/categorias/${slug}?page=${page}`, { accept: "text/html" });
          await ctx.snapshot(`${slug}/page-${page}.html`, res.text);

          const articles = res.text.split("<article").slice(1);
          const pages = Number(res.text.match(/last_page\?":(\d+)/)?.[1] ?? 1);
          ctx.log.info("eylstore.page", { slug, page, items: articles.length, pages });
          for (const article of articles) {
            const offer = toRawOffer(article, config.baseUrl, category);
            if (!offer || seen.has(offer.externalId)) continue;
            seen.add(offer.externalId);
            yield offer;
          }
          if (articles.length === 0 || page >= pages) break;
        }
      }
    },
  };
}

export function toRawOffer(article: string, baseUrl: string, category: Category): RawOffer | null {
  const href = article.match(/href="(\/producto\/[^"]+)"/)?.[1];
  if (!href) return null;
  const text = (re: RegExp) => decodeEntities(article.match(re)?.[1] ?? "").trim();

  const code = text(/<div class="mb-3[^"]*"><span>([^<]*)<\/span>/);
  const units = Number(article.match(/(\d+) unidades?/)?.[1] ?? 0);
  const gtin = normalizeGtin(code) ? code : null;

  return {
    externalId: href.slice("/producto/".length),
    url: `${baseUrl}${decodeEntities(href)}`,
    title: text(/<h3[^>]*>([^<]*)<\/h3>/),
    category,
    priceCash: parseClp(article.match(/>(\$[\d.]+)<\/div><div[^>]*>Transferencia</)?.[1]) ?? 0,
    priceCard: parseClp(article.match(/>(\$[\d.]+)<\/div><div[^>]*>Otros medios de pago</)?.[1]),
    inStock: units > 0,
    stockQuantity: units,
    brand: text(/<span class="mb-1[^"]*">([^<]*)<\/span>/) || null,
    // "SKU no informado", un número interno ("2417") o un modelo con espacios ("B550M K") no son MPN.
    mpn: !gtin && /^\S+$/.test(code) && /[a-z]/i.test(code) && /\d/.test(code) ? code : null,
    gtin,
    imageUrls: [article.match(/<img[^>]* src="(https:\/\/[^"]+)"/)?.[1]].filter((s): s is string => !!s),
  };
}
