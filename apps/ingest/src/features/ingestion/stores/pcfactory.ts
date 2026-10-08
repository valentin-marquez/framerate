import type { Category } from "@framerate/contracts";
import { stripHtml } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";

/**
 * PC Factory: la web es una SPA que lee su API pública. El listado por categoría trae precios y stock; el MPN
 * (`partNumber`) sólo viene en la ficha, así que se pide una por producto.
 * Precios verificados en la ficha (sept. 2026): `efectivo` = "Transferencia / Débito", `normal` = "Otros medios
 * de pago", `referencia` = el "antes" tachado.
 */

const API = "https://api.pcfactory.cl/pcfactory-services-catalogo/v1/catalogo/productos";
const PAGE_SIZE = 48; // máximo que acepta la API

export interface PcFactoryConfig {
  /** Categoría Framerate → ids de categoría de PC Factory (la API no incluye las subcategorías: van todas). */
  categories: Partial<Record<Category, readonly string[]>>;
}

const QuerySchema = z.object({
  content: z.object({
    items: z.array(z.unknown()),
    pageable: z.object({ totalPages: z.number() }),
  }),
});

const ItemSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  marca: z.string().nullable(),
  stock: z.string(),
  thumbnail: z.string().nullable(),
  precio: z.object({ efectivo: z.number(), normal: z.number() }),
  slug: z.string(),
  outlet: z.boolean().default(false),
});
type PcFactoryItem = z.infer<typeof ItemSchema>;

const DetailSchema = z.object({
  partNumber: z.string().nullable(),
  descripcion: z.string().nullable().optional(),
  // Pares nombre y valor. Las claves exactas no están verificadas contra una ficha real: se toman los textos del par.
  especificaciones: z.array(z.record(z.string(), z.unknown())).optional(),
});
type Detail = z.infer<typeof DetailSchema>;

export interface PcFactoryDetail {
  partNumber: string | null;
  sourceText: string | null;
}

const NO_DETAIL: PcFactoryDetail = { partNumber: null, sourceText: null };

const MAX_PAGES = 20;

export function createPcFactoryAdapter(config: PcFactoryConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const ids = config.categories[category];
      if (!ids?.length) return;
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await ctx.http.get(`${API}/query?page=${page}&size=${PAGE_SIZE}&categorias=${ids.join(",")}`);
        await ctx.snapshot(`query/page-${page}.json`, res.text);
        const { items, pageable } = QuerySchema.parse(JSON.parse(res.text)).content;
        ctx.log.info("pcfactory.page", { page, items: items.length, totalPages: pageable.totalPages });

        for (const raw of items) {
          const item = ItemSchema.safeParse(raw);
          if (!item.success) {
            yield raw as RawOffer;
            continue;
          }
          // Outlet = caja abierta o reacondicionado, y el título no siempre lo dice: `normalize` no lo vería.
          if (item.data.outlet) continue;
          yield toRawOffer(item.data, await detail(item.data.id, ctx), category);
        }
        if (page + 1 >= pageable.totalPages) break;
      }
    },
  };
}

/** Una ficha que falla no debe tumbar la categoría: la oferta entra igual, sin MPN ni texto. */
async function detail(id: number, ctx: CrawlContext): Promise<PcFactoryDetail> {
  try {
    const res = await ctx.http.get(`${API}/${id}`);
    await ctx.snapshot(`producto/${id}.json`, res.text);
    const parsed = DetailSchema.parse(JSON.parse(res.text));
    return { partNumber: parsed.partNumber?.trim() || null, sourceText: sourceTextOf(parsed) };
  } catch (error) {
    ctx.log.warn("pcfactory.detail_failed", { id, error });
    return NO_DETAIL;
  }
}

function sourceTextOf(d: Detail): string | null {
  const specs = (d.especificaciones ?? []).map((pair) =>
    Object.values(pair)
      .filter((v): v is string => typeof v === "string")
      .join(": "),
  );
  return [stripHtml(d.descripcion ?? ""), ...specs].filter(Boolean).join("\n") || null;
}

export function toRawOffer(
  item: PcFactoryItem,
  { partNumber, sourceText }: PcFactoryDetail,
  category: Category,
): RawOffer {
  const stock = Number(item.stock.replace(/\D/g, "")) || 0;
  const gtin = partNumber && normalizeGtin(partNumber) ? partNumber : null;
  return {
    externalId: String(item.id),
    url: `https://www.pcfactory.cl/producto/${item.slug}`,
    title: item.nombre,
    category,
    priceCash: Math.round(item.precio.efectivo),
    priceCard: item.precio.normal > 0 ? Math.round(item.precio.normal) : null,
    inStock: stock > 0,
    // "+30" es un piso, no la cantidad real.
    stockQuantity: stock > 0 && item.stock.startsWith("+") ? null : stock,
    brand: item.marca?.trim() || null,
    mpn: gtin ? null : partNumber,
    gtin,
    imageUrls: item.thumbnail ? [`https://assets.pcfactory.cl${item.thumbnail}`] : [],
    sourceText,
  };
}
