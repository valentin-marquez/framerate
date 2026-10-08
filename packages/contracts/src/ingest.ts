import { z } from "zod";
import { CategorySchema } from "./categories";

/**
 * Contrato RPC entre `apps/server` (API) y `apps/ingest` (scraping), vía service
 * binding de Cloudflare. La API no conoce las tiendas ni la cola: sólo le pide
 * a `ingest` que encole trabajo y él valida y decide.
 */

export const EnqueueCrawlsRequestSchema = z.object({
  /** Slug de la tienda; omitido = todas. */
  store: z.string().min(1).max(64).optional(),
  /** Categoría; omitida = todas las que vende cada tienda. */
  category: CategorySchema.optional(),
  /** Quién lo pidió (queda en la corrida para auditoría). */
  requestedBy: z.string().min(1).max(100),
});
export type EnqueueCrawlsRequest = z.infer<typeof EnqueueCrawlsRequestSchema>;

export type EnqueueCrawlsResult = { ok: true; enqueued: number } | { ok: false; error: "unknown_store" };

/**
 * Encola ofertas en una etapa del pipeline (#153): `normalize` para el backfill de identidades con Haiku, `link` para
 * re-vincular lo existente. Lo encola ingest porque es el productor de las dos colas.
 */
export const EnqueuePipelineRequestSchema = z.object({
  stage: z.enum(["normalize", "link"]),
  reason: z.enum(["backfill", "relink"]),
  category: CategorySchema.optional(),
  store: z.string().min(1).max(64).optional(),
  limit: z.number().int().min(1).max(5000).default(500),
  requestedBy: z.string().min(1).max(100),
});
export type EnqueuePipelineRequest = z.input<typeof EnqueuePipelineRequestSchema>;

/** `pipeline_off`: la etapa está apagada por su interruptor. */
export type EnqueuePipelineResult =
  | { ok: true; enqueued: number }
  | { ok: false; error: "unknown_store" | "pipeline_off" };

export interface IngestService {
  enqueueCrawls(request: EnqueueCrawlsRequest): Promise<EnqueueCrawlsResult>;
  enqueuePipeline(request: EnqueuePipelineRequest): Promise<EnqueuePipelineResult>;
}
