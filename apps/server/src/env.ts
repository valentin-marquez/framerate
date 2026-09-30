import type { CrawlMessage } from "@/features/ingestion/messages";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  /** Snapshots crudos de lo que devolvió cada tienda (auditoría y reprocesamiento). */
  SNAPSHOTS: R2Bucket;
  CRAWL_QUEUE: Queue<CrawlMessage>;
  PUBLIC_RATE_LIMITER?: RateLimit;
  /** Token para `/v1/admin/*`. Se define con `wrangler secret put ADMIN_TOKEN`. */
  ADMIN_TOKEN: string;
  /** "production" | "development". */
  ENVIRONMENT?: string;
}
