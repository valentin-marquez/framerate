import type { CrawlMessage } from "@/features/ingestion/messages";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  /** Snapshots crudos de lo que devolvió cada tienda (auditoría y reprocesamiento). */
  SNAPSHOTS: R2Bucket;
  CRAWL_QUEUE: Queue<CrawlMessage>;
}
