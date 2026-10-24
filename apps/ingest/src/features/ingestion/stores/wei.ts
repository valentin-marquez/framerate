import type { Category } from "@framerate/contracts";
import { decodeEntities, htmlLines, stripHtml } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { getPage, parseClp, refreshByPage } from "./html";

/**
 * Wei (PHP propio). El listado (`perpage=100`, `page` desde 0) trae URL, código interno y el precio de transferencia,
 * pero no el Part Number ni el precio tarjeta: se entra a cada ficha. Ficha: "Contado o Transferencia", "Tarjeta de
 * Débito o Crédito" (transferencia / 0,95) y un tercer precio en cuotas que no se usa. El título trae la marca delante
 * ("MSI - Tarjeta de Video ...").
 */

export interface WeiConfig {
  baseUrl: string;
  /** Categoría Framerate → id de categoría de la tienda. */
  categories: Partial<Record<Category, readonly string[]>>;
}

const MAX_PAGES = 20;

export function createWeiAdapter(config: WeiConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      for (const id of config.categories[category] ?? []) {
        let listed = 0;
        for (let page = 0; page < MAX_PAGES; page++) {
          const res = await ctx.http.get(
            `${config.baseUrl}/categoria/${id}?view=icon&perpage=100&page=${page}&order=disponibilidad`,
            { accept: "text/html" },
          );
          await ctx.snapshot(`${id}/page-${page}.html`, res.text);

          const items = res.text
            .split('<div class="box-producto">')
            .slice(1)
            .map((box) => ({
              url: box.match(/<a href="([^"]+)"/)?.[1],
              code: box.match(/class="code">([^<]+)</)?.[1],
            }));
          const total = Number(res.text.match(/de <span>(\d+)<\/span>/)?.[1] ?? 0);
          ctx.log.info("wei.page", { id, page, items: items.length, total });

          for (const { url, code } of items) {
            if (!url || !code || seen.has(code)) continue;
            seen.add(code);
            const html = await getPage(ctx, decodeEntities(url));
            if (!html) continue;
            await ctx.snapshot(`product-${code}.html`, html);
            const offer = toRawOffer(html, decodeEntities(url), category);
            // A veces el sitio devuelve una página sin el producto: no se emite una oferta vacía.
            if (!offer.externalId || !offer.title) {
              ctx.log.warn("wei.ficha_invalida", { url, code });
              continue;
            }
            yield offer;
          }

          listed += items.length;
          if (items.length === 0 || listed >= total) break;
        }
      }
    },
    refreshOffers: (refs, ctx) =>
      refreshByPage(refs, ctx, (html, ref) => {
        const offer = toRawOffer(html, ref.url, ref.category);
        return offer.externalId && offer.title ? offer : null;
      }),
  };
}

export function toRawOffer(html: string, url: string, category: Category): RawOffer {
  const text = (s: string | undefined) => decodeEntities(s ?? "").trim();
  const code = text(html.match(/C(?:ó|&oacute;)digo: <b>([^<]*)<\/b>/)?.[1]);
  const part = text(html.match(/Part Number: <b>([^<]*)<\/b>/)?.[1]);
  const title = text(html.match(/font-weight: 500; vertical-align: middle;[^>]*>\s*([^<]*?)\s*<\/div>/)?.[1]);
  const gtin = normalizeGtin(part) ? part : null;
  const units = Number(html.match(/(\d+) unidades?/)?.[1] ?? 0);
  const inStock = units > 0 || html.includes("Disponibilidad: En Stock");
  const image = html.match(new RegExp(`https://[^"?]*/img/product/${code}g.[a-z]+`))?.[0];

  return {
    externalId: code,
    url,
    title,
    category,
    priceCash: parseClp(html.match(/>(\$[\d.]+)<\/div>\s*<div[^>]*>Contado o Transferencia/)?.[1]) ?? 0,
    priceCard: parseClp(html.match(/>(\$[\d.]+)<\/div>\s*(?:<!--[\s\S]*?-->\s*)?<div[^>]*>Tarjeta de D/)?.[1]),
    inStock,
    stockQuantity: inStock ? units || null : 0,
    brand: title.match(/^(.+?) - /)?.[1]?.trim() || null,
    mpn: !gtin && part ? part : null,
    gtin,
    imageUrls: image ? [image] : [],
    sourceText: sourceTextOf(html),
  };
}

// Pestañas de la ficha: la primera es la descripción y la segunda "Especificación Técnica". La tabla va primero porque
// normalize recorta el texto.
function sourceTextOf(html: string): string | null {
  const tabs = html.match(
    /id="tab-producto"[\s\S]*?<div class="tab-body">([\s\S]*?)<div class="window-container"/,
  )?.[1];
  const [, description = "", specs = ""] = (tabs ?? "").split(/<div class="tab-content[^"]*"[^>]*>/);
  // El HTML de Wei trae saltos de línea entre celdas: se arma "clave: valor" por fila y sólo los bloques cortan línea.
  const rows = [...specs.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row = ""]) =>
    [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map(([, cell = ""]) => stripHtml(cell))
      .filter(Boolean)
      .join(": "),
  );
  return [...rows, htmlLines(description)].filter(Boolean).join("\n") || null;
}
