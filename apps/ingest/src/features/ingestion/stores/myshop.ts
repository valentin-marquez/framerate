import type { Category } from "@framerate/contracts";
import { decodeEntities, htmlLines } from "@framerate/kit";
import { normalizeGtin } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, OfferRef, StoreAdapter } from "./adapter";
import { fichaText, findLd, getPage, parseClp } from "./html";

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
    // `/servicio/producto` no acepta pedir por id (spike del 24-10, #121): el refresco es una ficha por oferta.
    async *refreshOffers(refs: readonly OfferRef[], ctx: CrawlContext) {
      let failures = 0;
      for (const ref of refs) {
        let html: string | null;
        try {
          html = await getPage(ctx, ref.url);
        } catch (error) {
          ctx.log.warn("myshop.refresh_failed", { url: ref.url, error });
          // Una ficha caída no tumba la hora; muchas seguidas sí: la tienda está cortando y no hay que insistir.
          if (++failures >= MAX_REFRESH_FAILURES) throw error;
          continue;
        }
        if (!html) continue;
        const offer = refreshedOffer(html, ref);
        if (offer) yield offer;
        else ctx.log.warn("myshop.refresh_unparsed", { url: ref.url });
      }
    },
  };
}

const MAX_REFRESH_FAILURES = 10;

/**
 * Oferta leída de la ficha: el JSON-LD trae nombre, códigos, foto, precio transferencia y disponibilidad; el precio de
 * otros medios y el stock online sólo están en el texto (MyShop: "$X Otros medios de pago", "Stock en Internet N
 * unidades"; Sandos: "Otros medios de pago $X", "Stock online N").
 */
export function refreshedOffer(html: string, ref: OfferRef): RawOffer | null {
  const product = findLd(html, "Product");
  const offers = product?.offers as Record<string, unknown> | undefined;
  const priceCash = Number(offers?.price);
  if (!product || typeof product.name !== "string" || !Number.isFinite(priceCash)) return null;

  const text = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")).replace(
    /\s+/g,
    " ",
  );
  const priceCard = parseClp(
    // Sandos lo pone después de la etiqueta; MyShop antes (y antes de la etiqueta también va el de transferencia).
    text.match(/Otros medios de pago\s*\$\s?([\d.]+)/)?.[1] ?? text.match(/\$\s?([\d.]+)\s*Otros medios de pago/)?.[1],
  );
  const stock = text.match(/Stock (?:en Internet|online)\s*(\d+)/i)?.[1];
  const inStock = String(offers?.availability ?? "").endsWith("InStock");
  const brand = (product.brand as { name?: unknown } | undefined)?.name;
  const gtin = product.gtin13 ?? product.gtin12 ?? product.gtin;

  return {
    externalId: ref.externalId,
    url: ref.url,
    title: product.name,
    category: ref.category,
    priceCash,
    priceCard: priceCard && priceCard > priceCash ? priceCard : null,
    inStock,
    // Misma regla que el listado: sobre 20 la tienda no dice la cantidad real.
    stockQuantity: !inStock ? 0 : stock && Number(stock) <= 20 ? Number(stock) : null,
    brand: typeof brand === "string" && brand.trim() ? brand.trim() : null,
    mpn: typeof product.mpn === "string" && product.mpn.trim() ? product.mpn.trim() : null,
    gtin: typeof gtin === "string" && normalizeGtin(gtin) ? gtin : null,
    imageUrls: photos([product.image].flat()),
  };
}

function photos(srcs: unknown[]): string[] {
  // La plataforma manda "fotos/nodisponible_*.png" (su logo con "próximamente imagen") cuando no hay foto.
  return srcs.filter(
    (src): src is string => typeof src === "string" && src.startsWith("http") && !src.includes("/nodisponible_"),
  );
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
    imageUrls: photos([item.foto, item.fotoSecundaria]),
  };
}
