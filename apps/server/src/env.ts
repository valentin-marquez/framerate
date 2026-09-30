import type { IngestService } from "@framerate/contracts";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  /** `apps/ingest` por RPC (service binding): la API le pide "crawlear ahora", no toca la cola. */
  INGEST: Service & IngestService;
  PUBLIC_RATE_LIMITER?: RateLimit;
  /** Token para `/v1/admin/*`. Se define con `wrangler secret put ADMIN_TOKEN`. */
  ADMIN_TOKEN: string;
  /** "production" | "development". */
  ENVIRONMENT?: string;
}
