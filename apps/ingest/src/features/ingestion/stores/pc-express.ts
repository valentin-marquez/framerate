import type { Category } from "@framerate/contracts";
import { decodeEntities } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { findLd, getPage, type LdNode, parseClp } from "./html";

/**
 * PC Express (OpenCart). El listado de categoría trae 20 productos por página (robots.txt prohíbe `limit=`) y
 * sólo muestra los que tienen stock, pero sin cantidades, MPN ni precio tarjeta: se entra a cada ficha.
 * Ficha: JSON-LD con nombre, marca y MPN (`sku` es "--"), "Transferencia/Efectivo", "Otros medios" (tarjeta:
 * transferencia −6 % según su página de formas de pago) y stock por sucursal. "Normal" es el precio "antes".
 */

export interface PcExpressConfig {
  baseUrl: string;
  /** Categoría Framerate → id de categoría OpenCart (el último tramo de `path`). */
  categories: Partial<Record<Category, readonly string[]>>;
}

const MAX_PAGES = 50;

const LIST_ITEM = /class="product-list__item" data-product-id="(\d+)">[\s\S]*?<a href="([^"]+)"/g;

export function createPcExpressAdapter(config: PcExpressConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      for (const path of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const listUrl = `${config.baseUrl}/index.php?route=product/category&path=${path}`;
          const res = await ctx.http.get(page > 1 ? `${listUrl}&page=${page}` : listUrl, { accept: "text/html" });
          await ctx.snapshot(`${path}/page-${page}.html`, res.text);

          const items = [...res.text.matchAll(LIST_ITEM)];
          const pages = Number(res.text.match(/\((\d+) páginas?\)/)?.[1] ?? 1);
          ctx.log.info("pc-express.page", { path, page, items: items.length, pages });
          for (const [, id = "", href = ""] of items) {
            if (seen.has(id)) continue;
            seen.add(id);
            const url = decodeEntities(href);
            const html = await getPage(ctx, url);
            if (!html) continue;
            await ctx.snapshot(`product-${id}.html`, html);
            yield toRawOffer(html, id, url, category);
          }

          if (items.length === 0 || page >= pages) break;
        }
      }
    },
  };
}

export function toRawOffer(html: string, id: string, url: string, category: Category): RawOffer {
  const ld = findLd(html, "Product") ?? {};
  const code = typeof ld.mpn === "string" ? ld.mpn.trim() : "";
  const gtin = normalizeGtin(code) ? code : null;

  // "Sin stock", "1 unidad", "+20 unidades". Casa matriz cuenta: la ficha deja comprar aunque la web esté en cero.
  const stock = [...html.matchAll(/id="stock-sucursal-\d+">([^<]*)/g)].map((m) => m[1]?.trim() ?? "");
  const units = stock.reduce((n, s) => n + Number(s.match(/\d+/)?.[0] ?? 0), 0);
  const availability = (ld.offers as LdNode | undefined)?.availability;
  const inStock = stock.length > 0 ? units > 0 : availability === "https://schema.org/InStock";

  return {
    externalId: id,
    url,
    title: typeof ld.name === "string" ? ld.name : "",
    category,
    priceCash: parseClp(html.match(/Transferencia\/Efectivo<\/span>\s*<h3[^>]*>([^<]*)/)?.[1]) ?? 0,
    priceCard: parseClp(html.match(/Otros medios<\/span>(?:\s*<img[^>]*>)?\s*<span[^>]*>([^<]*)/)?.[1]),
    inStock,
    stockQuantity: inStock ? (stock.some((s) => s.startsWith("+")) || !stock.length ? null : units) : 0,
    brand: ((ld.brand as LdNode | undefined)?.name as string | undefined)?.trim() || null,
    // Sin P/N la tienda copia el modelo del título ("BLADE CONCEPT BK ATX 1 USB-C"): con espacios no es un código.
    mpn: !gtin && code && !/\s/.test(code) ? code : null,
    gtin,
    imageUrls: [ld.image].flat().filter((src): src is string => typeof src === "string" && src.startsWith("http")),
  };
}
