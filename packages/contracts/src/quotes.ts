import { z } from "zod";
import { pageSchema, StoreSummarySchema } from "./catalog";
import { type Category, CategorySchema } from "./categories";
import { PublicProfileSchema } from "./identity";

/**
 * Cotizaciones (armador de PC): `/v1/quotes/*`. Cada ítem ocupa un slot del armado. En los slots exclusivos se
 * guardan alternativas pero sólo una está seleccionada (la que cuentan el total y la exportación); storage y
 * case_fan son aditivos. En la URL va el `public_id` de la cotización.
 */

export const QUOTE_SLOTS = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "psu",
  "case",
  "cpu_cooler",
  "storage",
  "case_fan",
] as const;
export const QuoteSlotSchema = z.enum(QUOTE_SLOTS);
export type QuoteSlot = z.infer<typeof QuoteSlotSchema>;

/** Slot que ocupa cada categoría; el servidor lo deriva al agregar un producto, el cliente no lo elige. */
export const SLOT_BY_CATEGORY: Record<Category, QuoteSlot> = {
  gpu: "gpu",
  cpu: "cpu",
  motherboard: "motherboard",
  ram: "ram",
  psu: "psu",
  ssd: "storage",
  hdd: "storage",
  cpu_cooler: "cpu_cooler",
  case: "case",
  case_fan: "case_fan",
};

export const QUOTE_SLOT_LABELS: Record<QuoteSlot, string> = {
  cpu: "Procesador",
  motherboard: "Placa madre",
  ram: "Memoria RAM",
  gpu: "Tarjeta de video",
  psu: "Fuente de poder",
  case: "Gabinete",
  cpu_cooler: "Refrigeración CPU",
  storage: "Almacenamiento",
  case_fan: "Ventilación",
};

/** En los slots aditivos todos los ítems cuentan; en los demás, sólo el seleccionado. */
const ADDITIVE_SLOTS: readonly QuoteSlot[] = ["storage", "case_fan"];
export const isAdditiveSlot = (slot: QuoteSlot) => ADDITIVE_SLOTS.includes(slot);

/** private: sólo el dueño. unlisted: quien tenga el link. public: además aparece en su perfil. */
export const QUOTE_VISIBILITIES = ["private", "unlisted", "public"] as const;
export const QuoteVisibilitySchema = z.enum(QUOTE_VISIBILITIES);
export type QuoteVisibility = z.infer<typeof QuoteVisibilitySchema>;

export const QuoteAuthorSchema = PublicProfileSchema.pick({ username: true, displayName: true, avatarUrl: true });
export type QuoteAuthor = z.infer<typeof QuoteAuthorSchema>;

export const QuoteSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: QuoteVisibilitySchema,
  /** Ítems seleccionados (los que cuentan en el total). */
  itemCount: z.number().int().nonnegative(),
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
  /** null si ninguna tienda tiene el producto con stock: el ítem no suma al total. */
  offer: QuoteItemOfferSchema.nullable(),
});
export type QuoteItem = z.infer<typeof QuoteItemSchema>;

/** Suma de los ítems seleccionados con oferta, por su cantidad: la usan el servidor y la web al actualizar sin esperar. */
export function quoteTotals(items: readonly QuoteItem[]) {
  let cash = 0;
  let card = 0;
  for (const item of items) {
    if (!item.isSelected || !item.offer) continue;
    cash += item.offer.priceCash * item.quantity;
    card += item.offer.priceCard * item.quantity;
  }
  return { cash, card };
}

export const QuoteDetailSchema = QuoteSummarySchema.extend({
  items: z.array(QuoteItemSchema),
  /** Suma de los ítems seleccionados con oferta, por su cantidad. */
  totals: z.object({ cash: z.number().int().nonnegative(), card: z.number().int().nonnegative() }),
});
export type QuoteDetail = z.infer<typeof QuoteDetailSchema>;

export const QuotePageSchema = pageSchema(QuoteSummarySchema);
export type QuotePage = z.infer<typeof QuotePageSchema>;

/** Tope de `pageSize`: pedir más da 400, no una página más grande. */
export const QUOTES_MAX_PAGE_SIZE = 50;

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

export const UpdateQuoteItemRequestSchema = z.object({ quantity: QuoteQuantitySchema });
export type UpdateQuoteItemRequest = z.infer<typeof UpdateQuoteItemRequestSchema>;
