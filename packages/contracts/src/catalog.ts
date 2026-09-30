import { z } from "zod";
import { CategorySchema } from "./categories";

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
});
export type StoreSummary = z.infer<typeof StoreSummarySchema>;

export const OfferSchema = z.object({
  store: StoreSummarySchema,
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
  slug: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  category: CategorySchema,
  imageUrl: z.url().nullable(),
  /** Mejor precio efectivo entre ofertas con stock; null si nadie tiene stock. */
  bestPrice: z.number().int().nonnegative().nullable(),
  offerCount: z.number().int().nonnegative(),
});
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

export const ProductDetailSchema = ProductSummarySchema.extend({
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  offers: z.array(OfferSchema),
});
export type ProductDetail = z.infer<typeof ProductDetailSchema>;

export const PricePointSchema = z.object({
  store: z.string(),
  priceCash: z.number().int().nonnegative(),
  priceCard: z.number().int().nonnegative(),
  inStock: z.boolean(),
  observedAt: z.iso.datetime(),
});
export type PricePoint = z.infer<typeof PricePointSchema>;

export const ProductSortSchema = z.enum(["relevance", "price_asc", "price_desc", "newest"]);
export type ProductSort = z.infer<typeof ProductSortSchema>;

export const ProductListQuerySchema = z.object({
  category: CategorySchema.optional(),
  brand: z.string().min(1).max(64).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  inStock: z.stringbool().optional(),
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

export const ProductPageSchema = pageSchema(ProductSummarySchema);
export type ProductPage = z.infer<typeof ProductPageSchema>;

/** Formato único de error de la API. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
