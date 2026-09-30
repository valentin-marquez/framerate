import { z } from "zod";
import { ProductSummarySchema } from "./catalog";
import { CategorySchema } from "./categories";

/** Contratos de tiendas y reseñas (`/v1/stores/*`, `/v1/reviews/*`). */

export const SOCIAL_KEYS = ["instagram", "x", "facebook", "tiktok", "youtube"] as const;
export const SocialSchema = z.partialRecord(z.enum(SOCIAL_KEYS), z.string().trim().min(1).max(200));
export type Social = z.infer<typeof SocialSchema>;

const RatingWindowSchema = z.object({ average: z.number().nullable(), count: z.number().int() });

export const StoreDetailSchema = z.object({
  slug: z.string(),
  /** Nombre mostrado: el que puso el dueño, o el canónico. */
  name: z.string(),
  canonicalName: z.string(),
  displayName: z.string().nullable(),
  url: z.string(),
  website: z.string().nullable(),
  description: z.string().nullable(),
  social: SocialSchema,
  iconUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  isActive: z.boolean(),
  isClaimed: z.boolean(),
  verifiedAt: z.string().nullable(),
  frozen: z.boolean(),
  createdAt: z.string(),
  offerCount: z.number().int(),
  rating: RatingWindowSchema.extend({ recent: RatingWindowSchema }),
});
export type StoreDetail = z.infer<typeof StoreDetailSchema>;

export const StoreRoleSchema = z.enum(["owner", "admin", "editor"]);
export type StoreRole = z.infer<typeof StoreRoleSchema>;

// ─── Reseñas ─────────────────────────────────────────────────────────────────

export const REVIEW_SORTS = ["recent", "helpful", "rating_desc"] as const;
export const ReviewSortSchema = z.enum(REVIEW_SORTS);
export type ReviewSort = z.infer<typeof ReviewSortSchema>;

export const ReviewAuthorSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
export type ReviewAuthor = z.infer<typeof ReviewAuthorSchema>;

export const StoreReviewSchema = z.object({
  deleted: z.literal(false),
  id: z.number().int(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  helpfulCount: z.number().int(),
  isPinned: z.boolean(),
  ownerResponse: z.string().nullable(),
  ownerResponseAt: z.string().nullable(),
  editedAt: z.string().nullable(),
  createdAt: z.string(),
  author: ReviewAuthorSchema.nullable(),
  mine: z.boolean(),
  votedByMe: z.boolean(),
});
export type StoreReview = z.infer<typeof StoreReviewSchema>;

/** Una reseña eliminada deja una lápida: no se expone el texto ni el autor. */
export const DeletedReviewSchema = z.object({
  deleted: z.literal(true),
  id: z.number().int(),
  reason: z.enum(["author", "moderation"]),
  isPinned: z.boolean(),
  createdAt: z.string(),
});
export type DeletedReview = z.infer<typeof DeletedReviewSchema>;

export const ReviewItemSchema = z.discriminatedUnion("deleted", [StoreReviewSchema, DeletedReviewSchema]);
export type ReviewItem = z.infer<typeof ReviewItemSchema>;

export const ReviewListSchema = z.object({
  items: z.array(ReviewItemSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  sort: ReviewSortSchema,
});
export type ReviewList = z.infer<typeof ReviewListSchema>;

export const RatingStatsSchema = z.object({
  average: z.number().nullable(),
  total: z.number().int(),
  distribution: z.object({
    1: z.number().int(),
    2: z.number().int(),
    3: z.number().int(),
    4: z.number().int(),
    5: z.number().int(),
  }),
});
export type RatingStats = z.infer<typeof RatingStatsSchema>;

const CommentSchema = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => v || null)
  .nullable();

export const CreateReviewRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: CommentSchema.optional(),
});
export type CreateReviewRequest = z.infer<typeof CreateReviewRequestSchema>;

/** El autor edita `rating`/`comment`; la organización dueña gestiona `ownerResponse` e `isPinned`. */
export const UpdateReviewRequestSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: CommentSchema,
    ownerResponse: z
      .string()
      .trim()
      .max(1000)
      .transform((v) => v || null)
      .nullable(),
    isPinned: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada que actualizar");
export type UpdateReviewRequest = z.infer<typeof UpdateReviewRequestSchema>;

export const DeleteReviewRequestSchema = z.object({ reason: z.string().trim().max(500).optional() });
export type DeleteReviewRequest = z.infer<typeof DeleteReviewRequestSchema>;

// ─── Productos de una tienda ─────────────────────────────────────────────────

export const StoreProductsSchema = z.object({
  total: z.number().int(),
  categories: z.array(
    z.object({
      category: CategorySchema,
      count: z.number().int(),
      /** Los más populares de la categoría, para el carrusel. */
      items: z.array(ProductSummarySchema),
    }),
  ),
});
export type StoreProducts = z.infer<typeof StoreProductsSchema>;
