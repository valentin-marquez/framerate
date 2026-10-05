import { createDb } from "@framerate/database";
import { createLogger } from "@framerate/kit";
import type { Env, VerifyMessage } from "./env";
import { reviewsForToday, type VerifyConfig, verifyReview } from "./verify";

/**
 * Worker que verifica las revisiones del Gatekeeper con Workers AI (#117). No recibe tráfico público:
 *  - scheduled: barre las pendientes sin veredicto y encola las que caben en el presupuesto diario de neurons.
 *  - queue:     una revisión por mensaje, en serie, con reintentos y DLQ.
 */
const log = createLogger({ feature: "match-verify" });

const configOf = (env: Env): VerifyConfig => ({
  mode: env.MATCH_MODE === "live" ? "live" : "shadow",
  dailyNeurons: Number(env.MATCH_DAILY_NEURONS) || 0,
});

export default {
  async scheduled(_controller, env) {
    const ids = await reviewsForToday(createDb(env.DB), configOf(env), new Date());
    // sendBatch acepta hasta 100 mensajes por llamada.
    for (let i = 0; i < ids.length; i += 100) {
      await env.VERIFY_QUEUE.sendBatch(ids.slice(i, i + 100).map((reviewId) => ({ body: { reviewId } })));
    }
    log.info("reviews.enqueued", { count: ids.length, ...configOf(env) });
  },

  async queue(batch, env) {
    const db = createDb(env.DB);
    for (const message of batch.messages) {
      try {
        await verifyReview(db, env.AI, message.body.reviewId, configOf(env), new Date(), log);
        message.ack();
      } catch (error) {
        log.error("review.verify_failed", { reviewId: message.body.reviewId, error });
        message.retry({ delaySeconds: 60 * message.attempts });
      }
    }
  },
} satisfies ExportedHandler<Env, VerifyMessage>;
