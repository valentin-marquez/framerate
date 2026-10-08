import { type PipelineMessage, PipelineMessageSchema } from "@framerate/contracts";
import { createDb } from "@framerate/database";
import { createLogger } from "@framerate/kit";
import { createNormalizer } from "@framerate/matching/normalize";
import type { Env } from "./env";
import { type NormalizeConfig, normalizeListing } from "./normalize";

/**
 * Worker que entiende cada oferta una sola vez con Haiku 5.5 (#153, spec 2026-10-08). Sin HTTP ni Cron: consume
 * `framerate-normalize` (una oferta por mensaje) y produce en `framerate-link` para que `framerate-match` decida.
 */
const log = createLogger({ feature: "normalize" });

const configOf = (env: Env): NormalizeConfig => ({
  mode: env.NORMALIZE_MODE === "off" || env.NORMALIZE_MODE === "live" ? env.NORMALIZE_MODE : "shadow",
  create: env.ANTHROPIC_API_KEY ? createNormalizer(env.ANTHROPIC_API_KEY) : null,
  monthlyUsd: Number(env.ANTHROPIC_MONTHLY_USD) || 0,
  cycleDay: Number(env.ANTHROPIC_CYCLE_DAY) || 1,
});

export default {
  async queue(batch, env) {
    const db = createDb(env.DB);
    const config = configOf(env);
    for (const message of batch.messages) {
      const parsed = PipelineMessageSchema.safeParse(message.body);
      if (!parsed.success) {
        // Un mensaje inválido nunca va a funcionar: se descarta (ack) y se registra.
        log.error("queue.invalid_message", { body: message.body, issues: parsed.error.issues });
        message.ack();
        continue;
      }
      const ctx = { now: new Date(), attempts: message.attempts, log };
      try {
        const outcome = await normalizeListing(db, env.LINK_QUEUE, parsed.data, config, ctx);
        if (outcome.status === "wait") {
          log.info("normalize.wait", { ...parsed.data, reason: outcome.reason, delaySeconds: outcome.delaySeconds });
          message.retry({ delaySeconds: outcome.delaySeconds });
        } else {
          message.ack();
        }
      } catch (error) {
        // D1 caído u otro fallo fuera de la API: reintento normal, sin haber gastado.
        log.error("normalize.failed", { ...parsed.data, error });
        message.retry({ delaySeconds: 60 * message.attempts });
      }
    }
  },
} satisfies ExportedHandler<Env, PipelineMessage>;
