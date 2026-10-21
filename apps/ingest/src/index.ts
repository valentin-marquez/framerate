import { WorkerEntrypoint } from "cloudflare:workers";
import {
  type EnqueueCrawlsRequest,
  EnqueueCrawlsRequestSchema,
  type EnqueueCrawlsResult,
  type EnqueuePipelineRequest,
  EnqueuePipelineRequestSchema,
  type EnqueuePipelineResult,
  type IngestService,
} from "@framerate/contracts";
import { createDb, refreshProductsPriceSummary } from "@framerate/database";
import { createLogger } from "@framerate/kit";
import type { Env } from "@/env";
import { recheckClaims } from "@/features/claims/recheck";
import { addSmallVariants, copyProductImages, resizerClient } from "@/features/images/product-images";
import {
  closeStuckRuns,
  deactivateStale,
  purgeDeletedAccountTickets,
  purgeQuarantine,
} from "@/features/ingestion/ingestion.repository";
import { type CrawlMessage, CrawlMessageSchema } from "@/features/ingestion/messages";
import {
  ensureAllScheduled,
  requestCrawls,
  requestPipeline,
  retryStuckNormalize,
  storeCrawler,
} from "@/features/ingestion/runtime";
import { applyViews7d, fetchViews7d } from "@/features/popularity/views";
import { emailSender } from "@/shared/email";

/**
 * Worker de ingesta: todo lo que toca tiendas externas. No recibe tráfico
 * público; sus disparadores son:
 *  - scheduled: Cron de 6 h → reintenta lo atascado en el pipeline, copia a R2 las fotos de producto pendientes y
 *               recalcula `views_7d` desde Analytics Engine. El horario revisa la agenda de cada `StoreCrawler`, que
 *               es quien crawlea cada tienda (#121).
 *  - queue:     reenvía al `StoreCrawler` lo que quedó en `framerate-crawl` de antes del coordinador.
 *  - RPC:       `IngestRpc`, que usa apps/server para "crawlear ahora" y para encolar el backfill del pipeline.
 */
const log = createLogger({ service: "framerate-ingest" });
/** Debe coincidir con `triggers.crons` de `wrangler.jsonc`. */
const HOURLY_CRON = "47 * * * *";

export class IngestRpc extends WorkerEntrypoint<Env> implements IngestService {
  async enqueueCrawls(request: EnqueueCrawlsRequest): Promise<EnqueueCrawlsResult> {
    // Los argumentos de RPC no están tipados en runtime: se validan como cualquier entrada.
    return requestCrawls(this.env, EnqueueCrawlsRequestSchema.parse(request));
  }

  async enqueuePipeline(request: EnqueuePipelineRequest): Promise<EnqueuePipelineResult> {
    return requestPipeline(this.env, EnqueuePipelineRequestSchema.parse(request));
  }
}

export { StoreCrawler } from "@/features/ingestion/store-crawler";

export default {
  async scheduled(controller, env) {
    if (controller.cron === HOURLY_CRON) {
      log.info("coordinator.ensured", { stores: await ensureAllScheduled(env) });
      return;
    }
    log.info("runs.closed_stuck", { closed: await closeStuckRuns(createDb(env.DB), new Date()) });
    log.info("normalize.retried", { retried: await retryStuckNormalize(env, new Date()) });
    log.info(
      "claims.rechecked",
      await recheckClaims(createDb(env.DB), new Date().toISOString(), undefined, emailSender(env)),
    );
    log.info("quarantine.purged", { deleted: await purgeQuarantine(createDb(env.DB), new Date()) });
    log.info("support.purged", { tickets: await purgeDeletedAccountTickets(createDb(env.DB), new Date()) });
    const stale = await deactivateStale(createDb(env.DB), new Date());
    if (stale.productIds.length > 0) await refreshProductsPriceSummary(createDb(env.DB), stale.productIds, new Date());
    (stale.skipped ? log.warn : log.info)("listings.stale", { deactivated: stale.deactivated, skipped: stale.skipped });
    const imageLog = log.child({ feature: "images" });
    if (env.RESIZER_URL && env.RESIZER_TOKEN) {
      const resize = resizerClient(env.RESIZER_URL, env.RESIZER_TOKEN);
      imageLog.info(
        "images.copied",
        await copyProductImages(createDb(env.DB), env.ASSETS, resize, new Date().toISOString(), imageLog),
      );
      imageLog.info("images.variants", await addSmallVariants(env.ASSETS, resize, imageLog));
    } else {
      imageLog.warn("images.skipped", { reason: "sin RESIZER_URL o RESIZER_TOKEN" });
    }
    if (env.CF_ACCOUNT_ID && env.ANALYTICS_API_TOKEN) {
      const views = await fetchViews7d(env.CF_ACCOUNT_ID, env.ANALYTICS_API_TOKEN);
      log.info("popularity.updated", await applyViews7d(createDb(env.DB), views));
    } else {
      log.warn("popularity.skipped", { reason: "sin CF_ACCOUNT_ID o ANALYTICS_API_TOKEN" });
    }
  },

  // Sólo para el deploy A; en el B se borran la cola, este consumidor y `messages.ts` (#201 §7).
  async queue(batch, env) {
    for (const message of batch.messages) {
      const parsed = CrawlMessageSchema.safeParse(message.body);
      if (parsed.success) {
        const { store, category, requestedBy } = parsed.data;
        await storeCrawler(env, store).enqueue(store, [category], requestedBy);
      } else {
        log.error("queue.invalid_message", { body: message.body, issues: parsed.error.issues });
      }
      message.ack();
    }
  },
} satisfies ExportedHandler<Env, CrawlMessage>;
