import { createApp } from "@/app";
import type { Env } from "@/env";
import { type CrawlMessage, CrawlMessageSchema } from "@/features/ingestion/messages";
import { enqueueAllCrawls, runCrawlMessage } from "@/features/ingestion/runtime";
import { createLogger } from "@/shared/logger";

/**
 * Punto de entrada del Worker. Tres disparadores, un solo despliegue:
 *  - fetch:     API HTTP (pública + admin).
 *  - scheduled: Cron → encola crawls.
 *  - queue:     consume crawls (uno por mensaje, con reintentos y DLQ).
 */
const app = createApp();
const log = createLogger({ service: "framerate-server" });

export default {
  fetch: app.fetch,

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
