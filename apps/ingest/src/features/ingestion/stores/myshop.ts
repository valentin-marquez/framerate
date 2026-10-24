import type { Category } from "@framerate/contracts";
import { decodeEntities, htmlLines } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { fichaText, getPage } from "./html";

/**
 * Plataforma propia de MyShop, que también usa Sandos: `POST /servicio/producto` con
 * `{ tipo: "3", page, idFamilia }` devuelve 12 productos por página (fijo) con MPN, marca,
 * precio transferencia (`precio`), precio tarjeta (`precio_tarjeta`) y stock.
 * `precio_normal` es el precio "antes" tachado: no se usa. La descripción no viene en el listado: sale de la ficha.
 */

export interface MyShopConfig {
  baseUrl: string;
  /** Categoría Framerate → `idFamilia` de la tienda (cada tienda numera distinto). */
  categories: Partial<Record<Category, readonly string[]>>;
  now?: () => number;
}

const PageSchema = z.object({
  codigo: z.number(),
  resultado: z.object({
    items: z.array(z.unknown()).default([]),
    productos: z.object({ fin: z.number().default(0), count: z.number().default(0) }).default({ fin: 0, count: 0 }),
  }),
});

const ItemSchema = z.object({
  id_producto: z.number(),
  nombre: z.string(),
  partno: z.string().nullable().default(""),
  marca: z.string().nullable().default(null),
  precio: z.number(),
  precio_tarjeta: z.number(),
  stock_total: z.number(),
  label: z.union([z.string(), z.boolean()]).nullable().default(null),
  url: z.string(),
  foto: z.string().nullable().default(null),
  fotoSecundaria: z.string().nullable().default(null),
});
type MyShopItem = z.infer<typeof ItemSchema>;

const MAX_PAGES = 100;

export function createMyShopAdapter(config: MyShopConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      for (const idFamilia of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await ctx.http.post(`${config.baseUrl}/servicio/producto`, {
            tipo: "3",
            page: String(page),
            idFamilia,
          });
          await ctx.snapshot(`familia-${idFamilia}/page-${page}.json`, res.text);

          const data = PageSchema.parse(JSON.parse(res.text));
          if (data.codigo !== 0) throw new Error(`MyShop: codigo ${data.codigo} en familia ${idFamilia}`);
          const { items, productos } = data.resultado;
          ctx.log.info("myshop.page", { idFamilia, page, items: items.length, count: productos.count });
          for (const raw of items) {
            const item = ItemSchema.safeParse(raw);
            if (!item.success) {
              yield raw as RawOffer;
              continue;
            }
            const offer = toRawOffer(item.data, category, config.baseUrl);
            offer.sourceText = await fichaText(ctx, offer, (config.now ?? Date.now)(), async () => {
              const html = await getPage(ctx, offer.url);
              if (!html) return null;
              await ctx.snapshot(`fichas/${offer.externalId}.html`, html);
              return descriptionOf(html);
            });
            yield offer;
          }

          if (items.length === 0 || productos.fin >= productos.count) break;
        }
      }
    },
  };
}

/** La ficha trae el producto en un input oculto; la descripción adentro es HTML con sus propias entidades. */
export function descriptionOf(html: string): string | null {
  const value = html.match(/<input id="ObjectoJSON" type="hidden" value="([^"]*)"/)?.[1];
  if (!value) return null;
  const parsed = z
    .object({ PRODUCTO: z.object({ descripcion: z.string().nullish() }) })
    .safeParse(JSON.parse(decodeEntities(value)));
  const text = htmlLines(parsed.data?.PRODUCTO.descripcion ?? "");
  return text && text !== "Ficha sin descripción" ? text : null;
}

export function toRawOffer(item: MyShopItem, category: Category, baseUrl: string): RawOffer {
  const partno = item.partno?.trim() ?? "";
  const gtin = normalizeGtin(partno) ? partno : null;
  const soldOut = typeof item.label === "string" && /agotado/i.test(item.label);
  const inStock = item.stock_total > 0 && !soldOut;

  return {
    externalId: String(item.id_producto),
    url: new URL(item.url, baseUrl).href,
    title: item.nombre,
    category,
    priceCash: item.precio,
    priceCard: item.precio_tarjeta > 0 ? item.precio_tarjeta : null,
    inStock,
    // Sobre 20 la tienda sólo muestra "+20" y manda 21: no es la cantidad real.
    stockQuantity: inStock ? (item.stock_total > 20 ? null : item.stock_total) : 0,
    brand: item.marca?.trim() || null,
    // En kits el partno junta los códigos internos de cada producto ("13024+43262"): no es un MPN.
    mpn: !gtin && partno && !partno.includes("+") ? partno : null,
    gtin,
    // La plataforma manda "fotos/nodisponible_*.png" (su logo con "próximamente imagen") cuando no hay foto.
    imageUrls: [item.foto, item.fotoSecundaria].filter(
      (src): src is string => !!src?.startsWith("http") && !src.includes("/nodisponible_"),
    ),
  };
}
