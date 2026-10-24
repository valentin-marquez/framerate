import type { Category } from "@framerate/contracts";
import { decodeEntities, htmlLines } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { fichaDue, getPage, parseClp, refreshByPage } from "./html";

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
  /** Reloj para el repaso diario de fichas (tests). */
  now?: () => number;
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
          const cards = listingCards(res.text);
          let reused = 0;
          if (cards.length === 0) {
            ctx.log.info("winpy.page", { path, page, items: 0, reused });
            break;
          }

          for (const { slug, priceCash } of cards) {
            if (seen.has(slug)) continue;
            seen.add(slug);
            const url = `${config.baseUrl}/venta/${slug}/`;
            // Winpy deja ~12 peticiones por minuto: la ficha sólo se pide si el producto es nuevo, si cambió su precio
            // o si le toca el repaso diario (stock y precio tarjeta, que el listado no trae).
            const known = await ctx.known?.(url);
            if (known && known.priceCash === priceCash && !fichaDue(slug, (config.now ?? Date.now)())) {
              reused++;
              yield { ...known, category };
              continue;
            }
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
          ctx.log.info("winpy.page", { path, page, items: cards.length, reused });
        }
      }
    },
    // ~12 peticiones por minuto (`minIntervalMs` del registro): las ~100 fichas importantes caben en la hora.
    refreshOffers: (refs, ctx) =>
      refreshByPage(refs, ctx, (html, ref) => {
        const offer = toRawOffer(html, ref.url, ref.category);
        return offer.externalId && offer.title ? offer : null;
      }),
  };
}

/** Cada tarjeta del listado (`<article>`): slug y precio de transferencia, el mismo `lowPrice` de la ficha. */
export function listingCards(html: string): { slug: string; priceCash: number | null }[] {
  return [...html.matchAll(/<article>([\s\S]*?)<\/article>/g)].flatMap((m) => {
    const block = m[1] as string;
    const slug = block.match(/href="\/venta\/([^"?/]+)\/"/)?.[1];
    if (!slug) return [];
    return [{ slug, priceCash: parseClp(block.match(/class="valor">([^<]*)</)?.[1] ?? "") }];
  });
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

// Las pestañas de la ficha: "Especificaciones" (content2, tabla de pares) y "Características" (content1, marketing,
// a veces vacía). Traen divs anidados, así que cada una se corta en el bloque hermano que la sigue y no en su `</div>`.
const TAB_END = {
  content1: /<label for="tab2"|<div id="content2"/,
  content2: /<div id="promociones"|<h3 class="titHome|<section|<footer/,
};

function tabText(html: string, id: keyof typeof TAB_END): string {
  const start = html.indexOf(`<div id="${id}"`);
  if (start < 0) return "";
  const rest = html.slice(start);
  const end = rest.search(TAB_END[id]);
  if (end < 0) return "";
  return htmlLines(rest.slice(0, end));
}

/** Especificaciones primero: `normalizeOffer` recorta el texto y el marketing es lo que sobra. */
export function sourceTextOf(html: string): string | null {
  return [tabText(html, "content2"), tabText(html, "content1")].filter(Boolean).join("\n") || null;
}

export function toRawOffer(html: string, url: string, category: Category): RawOffer {
  const sku = prop(html, "sku");
  const gtinRaw = prop(html, "gtin");
  // Winpy pone el mismo GTIN en todas sus fichas (433 de 433 el 18-10-2026): es un relleno, no del fabricante (#211).
  const gtin = normalizeGtin(gtinRaw) && normalizeGtin(gtinRaw) !== "00199275573873" ? gtinRaw : null;
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
    sourceText: sourceTextOf(html),
  };
}
