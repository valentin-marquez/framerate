import { PipelineMessageSchema } from "@framerate/contracts";
import { createDb } from "@framerate/database";
import { createLogger } from "@framerate/kit";
import { proposeDuplicateReviews } from "./detect";
import type { Env, LinkMessage, VerifyMessage } from "./env";
import { createHaiku } from "./haiku";
import { linkListing, linkModeOf, publishOverdue } from "./link";
import { extractModels } from "./model";
import { neuronsSpentSince } from "./reviews.repository";
import { reviewsForToday, type VerifyConfig, verifyReview } from "./verify";

/**
 * Worker que verifica las revisiones del Gatekeeper con Workers AI (#117) y vincula las ofertas normalizadas (#153).
 * No recibe tráfico público:
 *  - scheduled: publica lo oculto más de 24 h (`fallback`), propone revisiones para los duplicados ya creados (#148),
 *    barre las pendientes sin veredicto y encola las que caben en el presupuesto diario de neurons, y con lo que
 *    sobra saca el modelo del nombre donde no hay clave de atributos (#98).
 *  - queue:     `framerate-link`, una oferta por mensaje y en serie; `framerate-match-verify`, una revisión por
 *               mensaje. Las dos con reintentos y DLQ.
 */
const log = createLogger({ feature: "match-verify" });
const linkLog = createLogger({ feature: "link" });

const startOfDay = (now: Date) => `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;

const configOf = (env: Env): VerifyConfig => ({
  mode: env.MATCH_MODE === "live" || env.MATCH_MODE === "reject" ? env.MATCH_MODE : "shadow",
  dailyNeurons: Number(env.MATCH_DAILY_NEURONS) || 0,
  haiku:
    (env.MATCH_HAIKU === "shadow" || env.MATCH_HAIKU === "live") && env.ANTHROPIC_API_KEY
      ? {
          mode: env.MATCH_HAIKU,
          create: createHaiku(env.ANTHROPIC_API_KEY),
          monthlyUsd: Number(env.ANTHROPIC_MONTHLY_USD) || 0,
          cycleDay: Number(env.ANTHROPIC_CYCLE_DAY) || 1,
        }
      : undefined,
});

export default {
  async scheduled(_controller, env) {
    const db = createDb(env.DB);
    const config = configOf(env);
    const now = new Date();
    const detect = env.MATCH_DETECT === "shadow" || env.MATCH_DETECT === "on" ? env.MATCH_DETECT : "off";

    // 0. Nada queda oculto más de 24 h; las revisiones que deje el fallback entran al barrido de abajo.
    linkLog.info("link.overdue", await publishOverdue(db, now, linkLog));

    // 1. Saca el modelo del nombre donde no hay clave de atributos (#98). Va primero para que el detector ya lo vea
    //    en esta misma corrida, pero con un tope de un tercio del presupuesto: juzgar pares es lo que limpia.
    let spentNow = 0;
    if (detect !== "off") {
      const spent = await neuronsSpentSince(db, startOfDay(now));
      const budget = Math.min(config.dailyNeurons / 3, config.dailyNeurons - spent);
      if (budget > 0) {
        const models = await extractModels(db, env.AI, { now, neuronBudget: budget, log });
        spentNow = models.neurons;
        if (models.asked > 0) log.info("models.extracted", { ...models });
      }
    }

    // 2. Propone los duplicados ya creados, antes del barrido, para que el modelo los juzgue en la misma corrida.
    if (detect !== "off") {
      const found = await proposeDuplicateReviews(db, { now: new Date(), dryRun: detect === "shadow" });
      log.info("duplicates.detected", { mode: detect, ...found, samples: found.samples.slice(0, 5) });
    }

    // 3. Barre las pendientes con lo que queda del presupuesto (`reviewsForToday` descuenta lo ya gastado).
    // La extracción no deja rastro en `match_reviews`, así que su gasto se descuenta a mano.
    const ids = await reviewsForToday(db, config, new Date(), spentNow);
    // sendBatch acepta hasta 100 mensajes por llamada.
    for (let i = 0; i < ids.length; i += 100) {
      await env.VERIFY_QUEUE.sendBatch(ids.slice(i, i + 100).map((reviewId) => ({ body: { reviewId } })));
    }
    log.info("reviews.enqueued", { count: ids.length, ...config });
  },

  async queue(batch, env) {
    const db = createDb(env.DB);
    if (batch.queue === "framerate-link") {
      const mode = linkModeOf(env.PIPELINE_LINK);
      for (const message of batch.messages as Message<LinkMessage>[]) {
        const parsed = PipelineMessageSchema.safeParse(message.body);
        if (!parsed.success) {
          // Reintentar un mensaje malformado sólo lo manda a la DLQ con vueltas de más.
          linkLog.warn("link.invalid_message", { body: message.body, error: parsed.error.message });
          message.ack();
          continue;
        }
        try {
          await linkListing(db, parsed.data, mode, new Date(), linkLog, { sameAs: env.LINK_SAME_AS === "live" });
          message.ack();
        } catch (error) {
          linkLog.error("link.failed", { ...parsed.data, error });
          message.retry({ delaySeconds: 60 * message.attempts });
        }
      }
      return;
    }
    for (const message of batch.messages as Message<VerifyMessage>[]) {
      try {
        await verifyReview(db, env.AI, message.body.reviewId, configOf(env), new Date(), log);
        message.ack();
      } catch (error) {
        log.error("review.verify_failed", { reviewId: message.body.reviewId, error });
        message.retry({ delaySeconds: 60 * message.attempts });
      }
    }
  },
} satisfies ExportedHandler<Env, VerifyMessage | LinkMessage>;
