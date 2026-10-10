import type { Category } from "@framerate/contracts";
import { decodeEntities } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { getPage, parseClp } from "./html";

/**
 * Winpy (Magento, HTML del servidor). El listado (`/<ruta>/?pagina=N`, 40 por página, termina cuando viene vacío)
 * trae URL, marca y precio de transferencia; la ficha, los microdatos de schema.org: `sku` = MPN del fabricante
 * (`DUAL-RTX5050-O8G`; los kits llevan un código propio), `gtin`, `manufacturer`, `lowPrice` ("Transferencia o
 * Depósito"), `highPrice` ("Otros medios de pago") y `offerCount` = unidades en stock. Un `Disallow: /*filtro=*` en
 * su robots.txt: nunca se usan los filtros.
 */

export interface WinpyConfig {
  baseUrl: string;
  /** Categoría Framerate → rutas de categoría de la tienda ("partes-y-piezas/tarjetas-graficas"). */
  categories: Partial<Record<Category, readonly string[]>>;
}

const MAX_PAGES = 15;

export function createWinpyAdapter(config: WinpyConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      for (const path of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await ctx.http.get(`${config.baseUrl}/${path}/?pagina=${page}`, { accept: "text/html" });
          await ctx.snapshot(`${path.replaceAll("/", "_")}/page-${page}.html`, res.text);
          const urls = listingUrls(res.text);
          ctx.log.info("winpy.page", { path, page, items: urls.length });
          if (urls.length === 0) break;

          for (const slug of urls) {
            if (seen.has(slug)) continue;
            seen.add(slug);
            const url = `${config.baseUrl}/venta/${slug}/`;
            const html = await getPage(ctx, url);
            if (!html) continue;
            await ctx.snapshot(`product-${slug}.html`, html);
            const offer = toRawOffer(html, url, category);
            if (!offer.externalId || !offer.title) {
              ctx.log.warn("winpy.ficha_invalida", { url });
              continue;
            }
            yield offer;
          }
        }
      }
    },
  };
}

/** Slugs de producto del listado, sin los promocionados de la barra lateral (`?ref=`) y sin repetir. */
export function listingUrls(html: string): string[] {
  return [...new Set([...html.matchAll(/href="\/venta\/([^"?/]+)\/"/g)].map((m) => m[1] as string))];
}

const prop = (html: string, name: string) =>
  decodeEntities(html.match(new RegExp(`itemprop="${name}"[^>]*>([^<]*)<`))?.[1] ?? "").trim();

// El nombre puede traer una parte en negrita (`<h1 itemprop="name"><b>…</b> (8GB GDDR6)</h1>`): se lee el h1 entero.
const productName = (html: string) =>
  decodeEntities(
    (html.match(/<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " "),
  ).trim();

export function toRawOffer(html: string, url: string, category: Category): RawOffer {
  const sku = prop(html, "sku");
  const gtinRaw = prop(html, "gtin");
  const gtin = normalizeGtin(gtinRaw) ? gtinRaw : null;
  const units = Number(prop(html, "offerCount") || 0);
  // og:image es la miniatura relativa ("/files/tumb_42844-....jpg"); sin "tumb_" es la foto grande.
  const thumb = decodeEntities(html.match(/property="og:image" content="([^"]+)"/)?.[1] ?? "");
  const image = thumb ? new URL(thumb.replace("/files/tumb_", "/files/"), url).href : "";
  const brand = prop(html, "manufacturer");

  return {
    externalId: sku || url.match(/\/venta\/([^/]+)\//)?.[1] || "",
    url,
    title: productName(html),
    category,
    priceCash: parseClp(prop(html, "lowPrice")) ?? 0,
    priceCard: parseClp(prop(html, "highPrice")),
    inStock: units > 0,
    stockQuantity: units > 0 ? units : 0,
    brand: brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : null,
    // Los kits y armados llevan un código propio ("KT037XCL23"); `normalize` sólo acepta lo que parezca del fabricante.
    mpn: sku && !/^KT\d/i.test(sku) ? sku : null,
    gtin,
    imageUrls: image ? [image] : [],
  };
}
