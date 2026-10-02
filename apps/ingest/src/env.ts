import type { CrawlMessage } from "@/features/ingestion/messages";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  /** Snapshots crudos de lo que devolvió cada tienda (auditoría y reprocesamiento). */
  SNAPSHOTS: R2Bucket;
  /** Bucket público (cdn.framerate.cl): copia propia de las fotos de producto, bajo `products/`. */
  ASSETS: R2Bucket;
  /** Achica las fotos de producto una sola vez antes de guardarlas en ASSETS. */
  IMAGES: ImagesBinding;
  CRAWL_QUEUE: Queue<CrawlMessage>;
}
