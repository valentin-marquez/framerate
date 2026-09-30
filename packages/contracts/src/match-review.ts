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
