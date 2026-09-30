import { WorkerEntrypoint } from "cloudflare:workers";
import {
  type EnqueueCrawlsRequest,
  EnqueueCrawlsRequestSchema,
  type EnqueueCrawlsResult,
  type IngestService,
} from "@framerate/contracts";
import { createLogger } from "@framerate/kit";
import type { Env } from "@/env";
import { type CrawlMessage, CrawlMessageSchema } from "@/features/ingestion/messages";
import { enqueueAllCrawls, requestCrawls, runCrawlMessage } from "@/features/ingestion/runtime";

/**
 * Worker de ingesta: todo lo que toca tiendas externas. No recibe tráfico
 * público; sus disparadores son:
 *  - scheduled: Cron → encola un crawl por (tienda, categoría).
 *  - queue:     consume crawls (uno por mensaje, con reintentos y DLQ).
 *  - RPC:       `IngestRpc`, que usa apps/server para "crawlear ahora".
 */
const log = createLogger({ service: "framerate-ingest" });

export class IngestRpc extends WorkerEntrypoint<Env> implements IngestService {
  async enqueueCrawls(request: EnqueueCrawlsRequest): Promise<EnqueueCrawlsResult> {
    // Los argumentos de RPC no están tipados en runtime: se validan como cualquier entrada.
    return requestCrawls(this.env, EnqueueCrawlsRequestSchema.parse(request));
  }
}

export default {
  async scheduled(controller, env) {
    const enqueued = await enqueueAllCrawls(env, `cron:${controller.cron}`);
    log.info("cron.enqueued", { enqueued, cron: controller.cron });
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      const parsed = CrawlMessageSchema.safeParse(message.body);
      if (!parsed.success) {
        // Un mensaje inválido nunca va a funcionar: se descarta (ack) y se registra.
        log.error("queue.invalid_message", { body: message.body, issues: parsed.error.issues });
        message.ack();
        continue;
      }
      const result = await runCrawlMessage(env, parsed.data, log);
      if (result?.status === "failed") {
        // Backoff creciente; tras `max_retries` el mensaje va a la DLQ.
        message.retry({ delaySeconds: 300 * message.attempts });
      } else {
        message.ack();
      }
    }
  },
} satisfies ExportedHandler<Env, CrawlMessage>;
