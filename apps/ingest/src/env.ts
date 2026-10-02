import type { CrawlMessage } from "@/features/ingestion/messages";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  /** Snapshots crudos de lo que devolvió cada tienda (auditoría y reprocesamiento). */
  SNAPSHOTS: R2Bucket;
  /** Bucket público (cdn.framerate.cl): copia propia de las fotos de producto, bajo `products/`. */
  ASSETS: R2Bucket;
  CRAWL_QUEUE: Queue<CrawlMessage>;
}
