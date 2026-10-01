import type { Category } from "@framerate/contracts";
import { normalizeGtin } from "@framerate/matching";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { findLd, getPage, type LdNode, parseClp } from "./html";

/**
 * Tecnomas (Rails propio). El listado `/productos?categorias=[Nombre]` sólo muestra productos con stock y trae un
 * JSON-LD `ItemList` con las URLs de la página. La ficha trae JSON-LD `Product` (MPN, GTIN, marca, disponibilidad) y
 * en el HTML "Precio Transferencia" (`wire-transfer-price-<id>`) y "Precio Normal" (`webpay-price-<id>`, Webpay =
 * tarjeta). Con un único precio la ficha dice "Todo medio de pago" y no hay `webpay-price`.
 */

export interface TecnomasConfig {
  baseUrl: string;
  /** Categoría Framerate → nombres de categoría de la tienda. */
  categories: Partial<Record<Category, readonly string[]>>;
}

const PER_PAGE = 48;
const MAX_PAGES = 20;

export function createTecnomasAdapter(config: TecnomasConfig): StoreAdapter {
  async function listUrls(name: string, ctx: CrawlContext): Promise<string[]> {
    const urls = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      // Sólo "Nuevo": la tienda también lista caja abierta, reacondicionados y "Mejorado".
      const query = new URLSearchParams({
        categorias: `[${name}]`,
        condicion: "[Nuevo]",
        mostrar: String(PER_PAGE),
        pagina: String(page),
      });
      const res = await ctx.http.get(`${config.baseUrl}/productos?${query}`, { accept: "text/html" });
      await ctx.snapshot(`${name}/page-${page}.html`, res.text);

      const list = findLd(res.text, "ItemList");
      if (!list && !res.text.includes("No se han encontrado productos")) {
        throw new Error(`Tecnomas: listado sin ItemList en "${name}" página ${page}`);
      }
      const items = (list?.itemListElement ?? []) as { url?: string }[];
      for (const item of items) if (item.url) urls.add(item.url);
      ctx.log.info("tecnomas.page", { name, page, items: items.length, total: list?.numberOfItems });
      if (items.length < PER_PAGE || urls.size >= Number(list?.numberOfItems)) break;
    }
    return [...urls];
  }

  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      for (const name of config.categories[category] ?? []) {
        // Primero todas las URLs: el orden por relevancia puede moverse mientras se recorren las fichas.
        for (const url of await listUrls(name, ctx)) {
          const html = await getPage(ctx, url);
          if (!html) continue;
          await ctx.snapshot(`producto/${new URL(url).pathname.split("/").pop()}.html`, html);
          yield toRawOffer(html, url, category);
        }
      }
    },
  };
}

export function toRawOffer(html: string, url: string, category: Category): RawOffer {
  const ld = findLd(html, "Product") ?? {};
  const offer = (ld.offers ?? {}) as LdNode;
  // La ficha repite el bloque de precio y stock (escritorio y móvil): basta el primero.
  const byId = (id: string) => html.match(new RegExp(`id="${id}-\\d+"[^>]*>([^<]*)<`))?.[1];
  const inStock = /InStock$/.test(String(offer.availability ?? ""));
  const units = byId("stock")?.match(/(más de )?(\d+) unidad/);
  // `sku` y `mpn` son el mismo campo: casi siempre el código del fabricante; a veces un UPC/EAN.
  const sku = String(ld.mpn ?? ld.sku ?? "").trim();
  const ldGtin = String(ld.gtin ?? "").trim();
  const gtin = normalizeGtin(ldGtin) ? ldGtin : normalizeGtin(sku) ? sku : null;

  return {
    externalId: html.match(/id="name-(\d+)"/)?.[1] ?? url,
    url: String(ld.url ?? url),
    title: String(ld.name ?? ""),
    category,
    priceCash: parseClp(byId("wire-transfer-price")) ?? 0,
    priceCard: parseClp(byId("webpay-price")),
    inStock,
    // Sobre 20 la tienda sólo dice "más de 20 unidades".
    stockQuantity: !inStock ? 0 : units && !units[1] ? Number(units[2]) : null,
    brand: String((ld.brand as LdNode | undefined)?.name ?? "").trim() || null,
    mpn: sku && !normalizeGtin(sku) ? sku : null,
    gtin,
    imageUrls: [ld.image].flat().filter((src): src is string => typeof src === "string" && src.startsWith("http")),
  };
}
