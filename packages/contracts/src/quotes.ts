import { z } from "zod";
import { pageSchema, StoreSummarySchema } from "./catalog";
import { CategorySchema } from "./categories";
import { QuoteCompatibilitySchema } from "./compatibility";
import { PublicProfileSchema } from "./identity";
import { CONDENSE_STORE_VALUE, QUOTE_SLOTS, QUOTE_VISIBILITIES, QUOTES_MAX_PAGE_SIZE } from "./quote-slots";

/**
 * Cotizaciones (armador de PC): `/v1/quotes/*`. Cada ítem ocupa un slot del armado. En los slots exclusivos se
 * guardan alternativas pero sólo una está seleccionada (la que cuentan el total y la exportación); storage y
 * case_fan son aditivos. En la URL va el `public_id` de la cotización.
 */

// Constantes y cálculos sin zod (la web los importa): ver quote-slots.ts.
export * from "./quote-slots";

export const QuoteSlotSchema = z.enum(QUOTE_SLOTS);
export const QuoteVisibilitySchema = z.enum(QUOTE_VISIBILITIES);

export const QuoteAuthorSchema = PublicProfileSchema.pick({ username: true, displayName: true, avatarUrl: true });
export type QuoteAuthor = z.infer<typeof QuoteAuthorSchema>;

export const QuoteSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: QuoteVisibilitySchema,
  /** Ítems seleccionados (los que cuentan en el total). */
  itemCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
  author: QuoteAuthorSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type QuoteSummary = z.infer<typeof QuoteSummarySchema>;

/** Oferta con la que se cuenta el ítem: la elegida si sigue activa y con stock, y si no, el mejor precio actual. */
export const QuoteItemOfferSchema = z.object({
  id: z.number().int(),
  store: StoreSummarySchema,
  url: z.url(),
  priceCash: z.number().int().nonnegative(),
  priceCard: z.number().int().nonnegative(),
});
export type QuoteItemOffer = z.infer<typeof QuoteItemOfferSchema>;

export const QuoteItemSchema = z.object({
  id: z.number().int(),
  slot: QuoteSlotSchema,
  quantity: z.number().int().min(1).max(99),
  isSelected: z.boolean(),
  note: z.string().nullable(),
  product: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    brand: z.string().nullable(),
    category: CategorySchema,
    imageUrl: z.url().nullable(),
  }),
  /** La oferta que eligió el usuario (null = mejor precio). Si ya no tiene stock, `offer` es la mejor disponible. */
  chosenListingId: z.number().int().nullable(),
  /** null si ninguna tienda tiene el producto con stock: el ítem no suma al total. */
  offer: QuoteItemOfferSchema.nullable(),
  /** Hasta cuatro datos clave para mostrar como chips ("AM5", "8 núcleos"). Vacío en las alternativas. */
  specs: z.array(z.string()),
});
export type QuoteItem = z.infer<typeof QuoteItemSchema>;

export const QuoteDetailSchema = QuoteSummarySchema.extend({
  /** Sólo `GET /v1/quotes/:id` lo calcula para quien mira; las respuestas de edición (del dueño) siempre dicen `false`. */
  likedByMe: z.boolean(),
  items: z.array(QuoteItemSchema),
  /** Suma de los ítems seleccionados con oferta, por su cantidad. */
  totals: z.object({ cash: z.number().int().nonnegative(), card: z.number().int().nonnegative() }),
  compatibility: QuoteCompatibilitySchema,
});
export type QuoteDetail = z.infer<typeof QuoteDetailSchema>;

const CondenseStoreSchema = z.object({ slug: z.string(), name: z.string() });

/** Cuánto de más se acepta pagar por cada tienda que se evita; sin valor, el de siempre. */
export const QuoteCondenseQuerySchema = z.object({
  storeValue: z.coerce.number().int().min(0).max(1_000_000).default(CONDENSE_STORE_VALUE),
});
export type QuoteCondenseQuery = z.infer<typeof QuoteCondenseQuerySchema>;

/**
 * Propuesta para comprar en menos tiendas (`GET /v1/quotes/:id/condense`, sólo el dueño). Se compara con comprar cada
 * ítem en su tienda más barata; no incluye envíos. `improves` es falso cuando ya no se puede usar menos tiendas.
 */
export const QuoteCondensePlanSchema = z.object({
  improves: z.boolean(),
  storesBefore: z.number().int().nonnegative(),
  storesAfter: z.number().int().nonnegative(),
  /** Lo que cuesta de más el plan frente a la tienda más barata de cada ítem, por sus cantidades. */
  extraCash: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      itemId: z.number().int(),
      listingId: z.number().int(),
      store: CondenseStoreSchema,
      priceCash: z.number().int().nonnegative(),
      cheapestStore: CondenseStoreSchema,
      cheapestPriceCash: z.number().int().nonnegative(),
    }),
  ),
  stores: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      itemIds: z.array(z.number().int()),
      subtotalCash: z.number().int().nonnegative(),
    }),
  ),
});
export type QuoteCondensePlan = z.infer<typeof QuoteCondensePlanSchema>;

export const QuotePageSchema = pageSchema(QuoteSummarySchema);
export type QuotePage = z.infer<typeof QuotePageSchema>;

/** Una cotización pública en el inicio: el resumen, lo que cuesta hoy y fotos de hasta cuatro de sus componentes. */
export const PublicQuoteSchema = QuoteSummarySchema.extend({
  totalCash: z.number().int().nonnegative(),
  images: z.array(z.url()).max(4),
  /** Para quien mira; `false` sin sesión. */
  likedByMe: z.boolean(),
  /** Nombre del primer procesador y de la primera tarjeta de video seleccionados; `null` si el armado no los tiene. */
  cpu: z.string().nullable(),
  gpu: z.string().nullable(),
});
export type PublicQuote = z.infer<typeof PublicQuoteSchema>;

export const PublicQuotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  page: z.coerce.number().int().min(1).max(500).default(1),
});
export type PublicQuotesQuery = z.infer<typeof PublicQuotesQuerySchema>;

export const QuoteLikeSchema = z.object({ likeCount: z.number().int().nonnegative(), likedByMe: z.boolean() });
export type QuoteLike = z.infer<typeof QuoteLikeSchema>;

export const QuoteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(QUOTES_MAX_PAGE_SIZE).default(10),
});
export type QuoteListQuery = z.infer<typeof QuoteListQuerySchema>;

export const CreateQuoteRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullish(),
  visibility: QuoteVisibilitySchema.default("private"),
});
export type CreateQuoteRequest = z.infer<typeof CreateQuoteRequestSchema>;

/** Editar la cotización: cualquier combinación de campos, al menos uno; una descripción vacía la borra. */
export const UpdateQuoteRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(1000).nullish(),
    visibility: QuoteVisibilitySchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined || v.visibility !== undefined, {
    message: "Nada que cambiar",
  });
export type UpdateQuoteRequest = z.infer<typeof UpdateQuoteRequestSchema>;

export const QuoteQuantitySchema = z.number().int().min(1).max(99);

/** Agregar un producto; si ya está en la cotización, suma a su cantidad. */
export const AddQuoteItemRequestSchema = z.object({
  productId: z.number().int().positive(),
  quantity: QuoteQuantitySchema.default(1),
});
export type AddQuoteItemRequest = z.infer<typeof AddQuoteItemRequestSchema>;

/** Cambios a un ítem, al menos uno. `isSelected: true` lo hace el elegido de su slot (suelta al anterior). */
export const UpdateQuoteItemRequestSchema = z
  .object({
    quantity: QuoteQuantitySchema.optional(),
    isSelected: z.literal(true).optional(),
    /** La oferta que cuenta para este ítem; `null` vuelve al mejor precio. */
    listingId: z.number().int().positive().nullable().optional(),
  })
  .refine((v) => v.quantity !== undefined || v.isSelected !== undefined || v.listingId !== undefined, {
    message: "Nada que cambiar",
  });
export type UpdateQuoteItemRequest = z.infer<typeof UpdateQuoteItemRequestSchema>;
