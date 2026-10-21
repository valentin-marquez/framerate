import type { PipelineMessage } from "@framerate/contracts";
import type { StoreCrawler } from "@/features/ingestion/store-crawler";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  /** Snapshots crudos de lo que devolvió cada tienda (auditoría y reprocesamiento). */
  SNAPSHOTS: R2Bucket;
  /** Bucket público (cdn.framerate.cl): copia propia de las fotos de producto, bajo `products/`. */
  ASSETS: R2Bucket;
  /** Coordinador por tienda (#121): un Durable Object por slug, con su cola y su agenda. */
  STORE_CRAWLER: DurableObjectNamespace<StoreCrawler>;
  /** Productores del pipeline (#153); los consumen `framerate-normalize` y `framerate-match`. */
  NORMALIZE_QUEUE: Queue<PipelineMessage>;
  LINK_QUEUE: Queue<PipelineMessage>;
  /** Correos de la plataforma (avisos de reclamos); sin binding (tests) no se envía nada. */
  EMAIL?: SendEmail;
  /** Cuenta de Cloudflare, para la API SQL de Analytics Engine. */
  CF_ACCOUNT_ID?: string;
  /** Token con permiso "Account Analytics: Read". `wrangler secret put ANALYTICS_API_TOKEN`. Sin él no se recalcula
   * `views_7d`. */
  ANALYTICS_API_TOKEN?: string;
  /** Relay de salida en el servidor propio (#154), para tiendas con `egress: "relay"`. `wrangler secret put RELAY_TOKEN`. */
  RELAY_URL?: string;
  RELAY_TOKEN?: string;
  /** Achicador de fotos en el servidor propio (#170). `wrangler secret put RESIZER_TOKEN`. Sin él no se copian fotos. */
  RESIZER_URL?: string;
  RESIZER_TOKEN?: string;
}
