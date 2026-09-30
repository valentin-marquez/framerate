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

export interface IngestService {
  enqueueCrawls(request: EnqueueCrawlsRequest): Promise<EnqueueCrawlsResult>;
}
