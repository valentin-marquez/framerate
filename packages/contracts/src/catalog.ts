import { z } from "zod";
import { CategorySchema } from "./categories";
import { SpecFilterSchema } from "./facets";

export * from "./crawl-schedule";

/**
 * Contratos de la API pública de catálogo (`/v1/*`). El servidor valida sus
 * respuestas contra estos esquemas en tests, y la web los usa para tipar
 * y (opcionalmente) validar lo que recibe.
 *
 * Precios: enteros en CLP. `priceCash` = transferencia/efectivo,
 * `priceCard` = precio normal con tarjeta.
 */

export const StoreSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.url(),
  /** Ícono cuadrado espejado en el CDN; null si la tienda no tiene. */
  iconUrl: z.string().nullable(),
});
export type StoreSummary = z.infer<typeof StoreSummarySchema>;

export const OfferSchema = z.object({
  id: z.number().int(),
  store: StoreSummarySchema.extend({
    /** Promedio (un decimal) y cantidad de reseñas de la tienda; null si no tiene. */
    rating: z.object({ average: z.number(), count: z.number().int().positive() }).nullable().optional(),
  }),
  url: z.url(),
  title: z.string(),
  priceCash: z.number().int().nonnegative(),
  priceCard: z.number().int().nonnegative(),
  inStock: z.boolean(),
  stockQuantity: z.number().int().nonnegative().nullable(),
  lastSeenAt: z.iso.datetime(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const ProductSummarySchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  category: CategorySchema,
  imageUrl: z.url().nullable(),
  /** Mejor precio efectivo entre ofertas con stock; null si nadie tiene stock. */
  bestPrice: z.number().int().nonnegative().nullable(),
  /** Mejor precio con tarjeta entre ofertas con stock (puede ser de otra tienda que `bestPrice`); null si nadie tiene stock. */
  bestCardPrice: z.number().int().nonnegative().nullable(),
  mpn: z.string().nullable(),
  /** Atributos extraídos del título (chipset, VRAM, capacidad…). */
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  offerCount: z.number().int().nonnegative(),
  /**
   * Precio habitual (promedio del mejor precio diario de los 30 días previos, sin los 2 últimos); null sin historia
   * suficiente. Si `bestPrice` está bajo él, la diferencia es una baja real.
   */
  referencePrice: z.number().int().nonnegative().nullable(),
  /**
   * Sólo cuando la consulta filtra por especificación: "match" cumple con el dato conocido; "unknown" no tiene el
   * dato y va al final (podría cumplir).
   */
  specMatch: z.enum(["match", "unknown"]).optional(),
});
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

/** Especificación de la ficha, fundida desde las identidades de sus ofertas (#153); claves de `SPEC_FIELDS`. */
export const ProductSpecSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  /** Ninguna tienda lo dice: lo completó el normalizador por conocimiento del modelo. Se muestra con nota. */
  knowledge: z.boolean(),
});
export type ProductSpec = z.infer<typeof ProductSpecSchema>;

/** Otro producto de la misma familia (#101, `FAMILY_FIELDS`): la misma RTX 5070 de otra marca o línea. */
export const ProductVariantSchema = z.object({
  slug: z.string(),
  name: z.string(),
  imageUrl: z.url().nullable(),
  bestPrice: z.number().int().nonnegative().nullable(),
});
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const ProductDetailSchema = ProductSummarySchema.extend({
  offers: z.array(OfferSchema),
  specs: z.array(ProductSpecSchema),
  /** Los demás productos de la familia, con stock primero y luego por precio; hasta 8. La propia no va. */
  variants: z.array(ProductVariantSchema),
  /** Cuántos tiene la familia en total, sin contar este. */
  variantsTotal: z.number().int().nonnegative(),
});
export type ProductDetail = z.infer<typeof ProductDetailSchema>;

export const PricePointSchema = z.object({
  listingId: z.number().int(),
  store: z.string(),
  storeName: z.string(),
  priceCash: z.number().int().nonnegative(),
  priceCard: z.number().int().nonnegative(),
  inStock: z.boolean(),
  observedAt: z.iso.datetime(),
});
export type PricePoint = z.infer<typeof PricePointSchema>;

/** `discount`: mayor baja en pesos (`referencePrice − bestPrice`) primero. */
export const ProductSortSchema = z.enum([
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
  "popularity",
  "name",
  "discount",
]);
export type ProductSort = z.infer<typeof ProductSortSchema>;

export const ProductListQuerySchema = z.object({
  category: CategorySchema.optional(),
  /** Repetible (`brand=msi&brand=asus`): varias marcas son "o", como los valores de una misma faceta. */
  brand: z
    .preprocess((v) => (v === undefined ? undefined : [v].flat()), z.array(z.string().min(1).max(64)).max(20))
    .optional(),
  store: z.string().min(1).max(64).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  /** Filtros por especificación (`spec=vram:12`, repetible): ver facets.ts. */
  spec: z.preprocess((v) => (v === undefined ? undefined : [v].flat()), z.array(SpecFilterSchema).max(20)).optional(),
  /** Sólo productos bajo su precio habitual (página de ofertas). */
  deals: z
    .enum(["1", "true"])
    .transform(() => true)
    .optional(),
  sort: ProductSortSchema.default("relevance"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

export const ProductPageSchema = pageSchema(ProductSummarySchema).extend({
  /** Con filtros por especificación: cuántos del total son "unknown" (van al final). */
  specUnknown: z.number().int().nonnegative().optional(),
});
export type ProductPage = z.infer<typeof ProductPageSchema>;

export const CategoryItemSchema = z.object({
  id: CategorySchema,
  slug: z.string(),
  label: z.string(),
  productCount: z.number().int().nonnegative(),
});
export type CategoryItem = z.infer<typeof CategoryItemSchema>;

export const BrandCountSchema = z.object({ name: z.string(), slug: z.string(), count: z.number().int().nonnegative() });
export type BrandCount = z.infer<typeof BrandCountSchema>;

export const PriceRangeSchema = z.object({
  min: z.number().int().nonnegative().nullable(),
  max: z.number().int().nonnegative().nullable(),
});
export type PriceRange = z.infer<typeof PriceRangeSchema>;

/** Slugs de todo lo indexable, para `sitemap.xml`. */
export const SitemapSchema = z.object({
  products: z.array(z.string()),
  categories: z.array(z.string()),
  stores: z.array(z.string()),
});
export type Sitemap = z.infer<typeof SitemapSchema>;

/** Formato único de error de la API. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** `GET /v1/freshness`: cuándo se actualizaron las ofertas por última vez y cuándo toca la próxima vez. */
export const FreshnessSchema = z.object({
  /** Fin de la última corrida exitosa de cualquier tienda; null si nunca hubo una. */
  updatedAt: z.iso.datetime().nullable(),
  nextUpdateAt: z.iso.datetime(),
});
export type Freshness = z.infer<typeof FreshnessSchema>;
