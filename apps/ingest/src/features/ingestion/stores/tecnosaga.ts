import type { Category } from "@framerate/contracts";
import { z } from "zod";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, StoreAdapter } from "./adapter";
import { refreshByListing } from "./html";

/**
 * Tecno Saga (PHP propio). El listado se arma por XHR: `POST /productos/listadoajax` (formulario, exige
 * `X-Requested-With`) devuelve el JSON de 24 productos por página con marca, precio de transferencia
 * (`precio_normal`, "Efectivo o transferencia"), tarjeta (`precio_tarjeta`) y stock por sucursal. El `sku` es
 * interno y no hay MPN: sólo aparece en el título, de donde lo saca `normalize`. Las subcategorías vienen
 * contaminadas (una placa madre en "Tarjetas de video"): también las separa `normalize` por título.
 */

export interface TecnoSagaConfig {
  baseUrl: string;
  /** Categoría Framerate → "categoria/subcategoria" de la tienda (`8/91`). */
  categories: Partial<Record<Category, readonly string[]>>;
}

const MAX_PAGES = 20;

const ItemSchema = z.object({
  id: z.string(),
  descripcion: z.string(),
  url: z.string(),
  precio_normal: z.string(),
  precio_tarjeta: z.string(),
  stock_sucursal_placer: z.string(),
  stock_sucursal_catedral: z.string(),
  stock_sucursal_bodega: z.string(),
  imagen: z.string().nullable().default(null),
  marca_descripcion: z.string().nullable().default(null),
});

const PageSchema = z.object({
  error: z.unknown().optional(),
  // `false` cuando la subcategoría está vacía.
  productos: z.union([z.array(z.unknown()), z.literal(false)]),
  cantidad_paginas: z.number().default(1),
});

export function createTecnoSagaAdapter(config: TecnoSagaConfig): StoreAdapter {
  return {
    categories: config.categories,
    async *crawlCategory(category: Category, ctx: CrawlContext) {
      const seen = new Set<string>();
      for (const path of config.categories[category] ?? []) {
        const [idCategoria = "", idSubcategoria = ""] = path.split("/");
        for (let page = 1; page <= MAX_PAGES; page++) {
          const form = new URLSearchParams({
            orden: "mas_vendido",
            mostrar: "24",
            id_categoria: idCategoria,
            id_subcategoria: idSubcategoria,
            pagina: String(page),
            pagina_oferta: "0",
            producto_buscador: "",
          });
          const res = await ctx.http.post(`${config.baseUrl}/productos/listadoajax`, form.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
          });
          await ctx.snapshot(`${idCategoria}-${idSubcategoria}/page-${page}.json`, res.text);

          const data = PageSchema.parse(JSON.parse(res.text));
          const items = data.productos || [];
          ctx.log.info("tecnosaga.page", { path, page, items: items.length, pages: data.cantidad_paginas });
          for (const item of items) {
            const p = ItemSchema.parse(item);
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            yield toRawOffer(p, config.baseUrl, category);
          }
          if (items.length === 0 || page >= data.cantidad_paginas) break;
        }
      }
    },
    // El listado ya trae precio y stock: el refresco es el mismo recorrido, cortado al ver las ofertas pedidas.
    refreshOffers(refs, ctx) {
      return refreshByListing(refs, (category) => this.crawlCategory(category, ctx));
    },
  };
}

export function toRawOffer(p: z.infer<typeof ItemSchema>, baseUrl: string, category: Category): RawOffer {
  const units = Number(p.stock_sucursal_placer) + Number(p.stock_sucursal_catedral) + Number(p.stock_sucursal_bodega);
  const inStock = units > 0;
  return {
    externalId: p.id,
    url: `${baseUrl}/productos/detalle/${p.url}`,
    title: p.descripcion.trim(),
    category,
    priceCash: Number(p.precio_normal),
    priceCard: Number(p.precio_tarjeta) || null,
    inStock,
    stockQuantity: inStock ? units : 0,
    brand: p.marca_descripcion?.trim() || null,
    mpn: null,
    gtin: null,
    imageUrls: p.imagen ? [`${baseUrl}/images/productos/${p.imagen}`] : [],
  };
}
