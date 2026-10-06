import { z } from "zod";

/** Cola de revisión humana de matches dudosos (`GET /v1/admin/reviews`). */
export const MatchReviewItemSchema = z.object({
  id: z.number().int(),
  /** Similitud 0–1 entre la oferta y el producto candidato. */
  score: z.number(),
  evidence: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  listing: z.object({
    id: z.number().int(),
    title: z.string(),
    url: z.url(),
    priceCash: z.number().int(),
    priceCard: z.number().int(),
    inStock: z.boolean(),
    imageUrl: z.url().nullable(),
    mpn: z.string().nullable(),
    gtin: z.string().nullable(),
    productId: z.number().int().nullable(),
    store: z.object({ slug: z.string(), name: z.string() }),
  }),
  candidate: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    brand: z.string().nullable(),
    category: z.string(),
    imageUrl: z.url().nullable(),
  }),
});
export type MatchReviewItem = z.infer<typeof MatchReviewItemSchema>;

export const MatchReviewsResponseSchema = z.object({ items: z.array(MatchReviewItemSchema) });
export type MatchReviewsResponse = z.infer<typeof MatchReviewsResponseSchema>;

/** `POST /v1/admin/listings/:id/split`: la oferta vuelve a su producto anterior (o a uno nuevo). */
export const SplitListingResponseSchema = z.object({ productId: z.number().int(), created: z.boolean() });
export type SplitListingResponse = z.infer<typeof SplitListingResponseSchema>;

/** `POST /v1/admin/match-reviews/revert-ai`: separa en bloque las aceptaciones de la IA, opcionalmente de un modelo y un rango. */
export const RevertAiRequestSchema = z.object({
  model: z.string().min(1).optional(),
  since: z.iso.datetime().optional(),
  until: z.iso.datetime().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type RevertAiRequest = z.infer<typeof RevertAiRequestSchema>;

export const RevertAiResponseSchema = z.object({
  reverted: z.number().int(),
  /** Quedan aceptaciones por separar: repetir la llamada. */
  remaining: z.number().int(),
});
export type RevertAiResponse = z.infer<typeof RevertAiResponseSchema>;
