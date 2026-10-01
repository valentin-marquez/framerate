import type { Category } from "@framerate/contracts";
import { normalizeGtin } from "@framerate/matching";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { getPage } from "./html";

/**
 * Tiendas Jumpseller. El catálogo sale del servidor MCP público de la plataforma (`POST /api/mcp`, JSON-RPC,
 * anunciado en el robots.txt de cada tienda): `list_products` filtra por permalink de categoría y trae SKU, marca,
 * código de barras, fotos y stock. Su `price` ignora las promociones de la tienda (Valrod: $74.990 en MCP, $54.990
 * en la ficha), así que el precio de los productos con stock se lee de la ficha, del meta `product:price:amount`
 * que inyecta la plataforma en todos los temas.
 */

export interface JumpsellerConfig {
  /** Host final: un 301 (p. ej. a `www.`) convierte el POST al MCP en GET. */
  baseUrl: string;
  /** Categoría Framerate → permalinks de categoría de la tienda (la categoría padre incluye a sus hijas). */
  categories: Partial<Record<Category, readonly string[]>>;
  /**
   * Categoría Framerate → nombres de categoría de la tienda cuyos productos se omiten, cuando la tienda repite
   * productos de otra categoría (NotebookStore lista todos sus SSD también en "Discos Duros Internos").
   */
  exclude?: Partial<Record<Category, readonly string[]>>;
  /**
   * Qué es el SKU en esta tienda: "mpn" (código del fabricante; si es un UPC/EAN válido se usa como GTIN) o
   * "internal". El GTIN sale sobre todo del código de barras.
   */
  sku: "mpn" | "internal";
  /** El precio publicado es el de tarjeta y la ficha muestra la transferencia con este descuento (0.03 = −3 %). */
  cashDiscount?: number;
  perPage?: number;
}

const McpResponseSchema = z.object({
  result: z.object({
    content: z.array(z.object({ text: z.string() })).min(1),
    isError: z.boolean().optional(),
  }),
});

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.url(),
  price: z.number(),
  sku: z.string().nullable(),
  brand: z.string().nullable(),
  barcode: z.string().nullable(),
  stock_available: z.boolean(),
  images: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
});
type JumpsellerProduct = z.infer<typeof ProductSchema>;

const MAX_PAGES = 20;

export function createJumpsellerAdapter(config: JumpsellerConfig): StoreAdapter {
  const perPage = config.perPage ?? 100;

  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      const excluded = config.exclude?.[category] ?? [];
      for (const permalink of config.categories[category] ?? []) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await ctx.http.post(
            `${config.baseUrl}/api/mcp`,
            {
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: { name: "list_products", arguments: { category: permalink, page, limit: perPage } },
            },
            { accept: "application/json, text/event-stream" },
          );
          await ctx.snapshot(`${permalink}/page-${page}.json`, res.text);

          const items = parseItems(res.text);
          ctx.log.info("jumpseller.page", { permalink, page, items: items.length });
          for (const item of items) {
            const parsed = ProductSchema.safeParse((item as { product?: unknown })?.product);
            if (!parsed.success) {
              yield item as RawOffer;
              continue;
            }
            const product = parsed.data;
            if (seen.has(product.id) || excluded.some((name) => product.categories.includes(name))) continue;
            seen.add(product.id);

            let listed = product.price;
            // Las fichas de productos agotados no se piden: basta el precio del MCP.
            if (product.stock_available) {
              const ficha = await getPage(ctx, product.url);
              if (!ficha) continue;
              await ctx.snapshot(`fichas/${externalId(product)}.html`, ficha);
              // Sin el meta queda 0 y `normalize` lo manda a cuarentena: mejor que callar una promoción.
              listed = Number(ficha.match(/<meta property="product:price:amount" content="([\d.]+)"/)?.[1] ?? 0);
            }
            yield toRawOffer(product, Math.round(listed), category, config);
          }

          if (items.length < perPage) break;
        }
      }
    },
  };
}

function parseItems(text: string): unknown[] {
  const { result } = McpResponseSchema.parse(JSON.parse(text));
  const body = result.content[0]?.text ?? "";
  if (result.isError) throw new Error(`Jumpseller MCP: ${body}`);
  const items: unknown = JSON.parse(body);
  if (!Array.isArray(items)) throw new Error("Jumpseller MCP: se esperaba un arreglo de productos");
  return items;
}

const externalId = (p: JumpsellerProduct) => p.id.split("/").pop() ?? p.id;

export function toRawOffer(
  p: JumpsellerProduct,
  listed: number,
  category: Category,
  config: Pick<JumpsellerConfig, "sku" | "cashDiscount">,
): RawOffer {
  const sku = p.sku?.trim() || null;
  const barcode = p.barcode?.trim() || null;
  // Un SKU interno de 13 dígitos puede pasar el checksum por azar: sólo se mira si la tienda usa códigos de fabricante.
  const gtin = [barcode, config.sku === "mpn" ? sku : null].find((code) => normalizeGtin(code)) ?? null;

  return {
    externalId: externalId(p),
    url: p.url,
    title: p.name,
    category,
    priceCash: config.cashDiscount ? Math.round(listed * (1 - config.cashDiscount)) : listed,
    priceCard: config.cashDiscount ? listed : null,
    inStock: p.stock_available,
    stockQuantity: p.stock_available ? null : 0,
    brand: p.brand?.trim() || null,
    mpn: config.sku === "mpn" && sku && !normalizeGtin(sku) ? sku : null,
    gtin,
    imageUrls: p.images.filter((src) => src.startsWith("http")),
  };
}
