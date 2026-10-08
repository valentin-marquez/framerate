import { z } from "zod";

/** Estado de una oferta en el pipeline de normalización (`listings.norm_status`). */
export const NORM_STATUSES = ["legacy", "pending", "normalized", "linked", "fallback", "failed"] as const;
export type NormStatus = (typeof NORM_STATUSES)[number];

/**
 * Mensaje de las colas `framerate-normalize` y `framerate-link`: una oferta por mensaje, sin texto (el consumidor
 * lee `listings`, así un reintento siempre ve el estado actual).
 */
export const PipelineMessageSchema = z.object({
  listingId: z.number().int().positive(),
  /** `NORMALIZER_VERSION` con la que se encoló. */
  version: z.number().int().positive(),
  reason: z.enum(["new", "changed", "backfill", "relink"]),
});
export type PipelineMessage = z.infer<typeof PipelineMessageSchema>;
export type NormalizeMessage = PipelineMessage;
export type LinkMessage = PipelineMessage;
