import type { PipelineMessage } from "@framerate/contracts";
import type { PipelineMode } from "@/features/ingestion/crawl-category";
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
  /** Productores del pipeline (#153); los consumen `framerate-normalize` y `framerate-match`. */
  NORMALIZE_QUEUE: Queue<PipelineMessage>;
  LINK_QUEUE: Queue<PipelineMessage>;
  /** off (por defecto) | shadow | live: con shadow o live, lo nuevo o cambiado queda `pending` y se encola. */
  PIPELINE_NORMALIZE?: PipelineMode;
  /** off (por defecto) | shadow | live: sólo live saca el vínculo de la corrida y oculta lo nuevo hasta vincularlo. */
  PIPELINE_LINK?: PipelineMode;
  /** Correos de la plataforma (avisos de reclamos); sin binding (tests) no se envía nada. */
  EMAIL?: SendEmail;
  /** Cuenta de Cloudflare, para la API SQL de Analytics Engine. */
  CF_ACCOUNT_ID?: string;
  /** Token con permiso "Account Analytics: Read". `wrangler secret put ANALYTICS_API_TOKEN`. Sin él no se recalcula
   * `views_7d`. */
  ANALYTICS_API_TOKEN?: string;
}
