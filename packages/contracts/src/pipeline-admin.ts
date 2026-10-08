import { z } from "zod";
import { CategorySchema } from "./categories";
import { EnqueuePipelineRequestSchema } from "./ingest";

/** Administración del pipeline de normalización (#153), bajo `/v1/admin/pipeline`. */

/** `POST /v1/admin/pipeline/normalize` (backfill de identidades) y `/relink` (re-vincular con la sombra aprobada). */
export const PipelineEnqueueRequestSchema = EnqueuePipelineRequestSchema.pick({
  category: true,
  store: true,
  limit: true,
});
export type PipelineEnqueueRequest = z.input<typeof PipelineEnqueueRequestSchema>;

export const PipelineEnqueueResponseSchema = z.object({ enqueued: z.number().int().nonnegative() });
export type PipelineEnqueueResponse = z.infer<typeof PipelineEnqueueResponseSchema>;

const ShadowProductSchema = z.object({ id: z.number().int(), slug: z.string(), name: z.string() });

/**
 * `GET /v1/admin/pipeline/shadow?category=`: qué haría `decide` con la identidad de Haiku contra el vínculo actual
 * (`match_shadow`, última versión por oferta). Corte de la spec: ≤ 3 % de movimientos y la muestra revisada a mano.
 */
export const PipelineShadowReportSchema = z.object({
  category: CategorySchema,
  /** Versión del normalizador más alta vista en la categoría; null sin sombra. */
  version: z.number().int().nullable(),
  total: z.number().int().nonnegative(),
  /** Coincide con el vínculo actual. */
  agrees: z.number().int().nonnegative(),
  /** Movería la oferta a otro producto: el lado peligroso (fusión equivocada). */
  moves: z.number().int().nonnegative(),
  newProducts: z.number().int().nonnegative(),
  reviews: z.number().int().nonnegative(),
  /** Hasta 30 desacuerdos, los movimientos primero, para revisar a mano. */
  sample: z.array(
    z.object({
      listingId: z.number().int(),
      title: z.string(),
      store: z.string(),
      kind: z.enum(["link", "review", "new_product"]),
      score: z.number(),
      vetoes: z.unknown(),
      current: ShadowProductSchema.nullable(),
      proposed: ShadowProductSchema.nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export type PipelineShadowReport = z.infer<typeof PipelineShadowReportSchema>;
