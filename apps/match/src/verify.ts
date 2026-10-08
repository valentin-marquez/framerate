import type { Db } from "@framerate/database";
import type { Logger } from "@framerate/kit";
import { resolveMatchReview } from "@framerate/matching";
import { acceptGuard } from "./guard";
import {
  billingCycle,
  type createHaiku,
  dailyCapUsd,
  HAIKU_MODEL,
  type HaikuCall,
  haikuOpinion,
  USD_PER_PAIR,
} from "./haiku";
import { judge, MODEL } from "./judge";
import { type AiEvidence, loadPair, neuronsSpentSince, reviewsToVerify, saveAiEvidence } from "./reviews.repository";
import { recordUsage, usdSpentSince } from "./usage";

// Estimación por par para repartir el presupuesto: 2,5 de Gemma medidos, con margen. El tope diario se respeta igual
// porque el barrido mide lo gastado antes de encolar.
const NEURONS_PER_PAIR = 3;

export interface HaikuConfig {
  mode: "shadow" | "live";
  create: ReturnType<typeof createHaiku>;
  /** Parte del crédito mensual de Anthropic que puede usar este Worker. */
  monthlyUsd: number;
  /** Día del mes en que se renueva el crédito (el del pago del plan). */
  cycleDay: number;
}

export interface VerifyConfig {
  mode: "shadow" | "reject" | "live";
  dailyNeurons: number;
  /** Sin configurar (o sin clave), Haiku no se usa. */
  haiku?: HaikuConfig;
}

const startOfDay = (now: Date) => `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;

/** Dólares que Haiku todavía puede gastar hoy según el tope ligado al ciclo de facturación; lo gastado sale de `ai_usage`. */
export async function haikuBudgetLeft(db: Db, haiku: HaikuConfig, now: Date): Promise<number> {
  const cycleStart = billingCycle(now, haiku.cycleDay).start.toISOString();
  const [inCycle, today] = await Promise.all([usdSpentSince(db, cycleStart), usdSpentSince(db, startOfDay(now))]);
  return dailyCapUsd(now, haiku.cycleDay, haiku.monthlyUsd, inCycle - today) - today;
}

/**
 * Cuántas revisiones caben hoy en el presupuesto, y cuáles. `spentExtra` son los neurons gastados en esta misma
 * corrida que todavía no están en `match_reviews` (la extracción de modelos de #98): sin descontarlos, el tope
 * diario se pasaría.
 */
export async function reviewsForToday(db: Db, config: VerifyConfig, now: Date, spentExtra = 0): Promise<number[]> {
  const left = config.dailyNeurons - (await neuronsSpentSince(db, startOfDay(now))) - spentExtra;
  const pairs = Math.floor(left / NEURONS_PER_PAIR);
  if (pairs <= 0) return [];
  const haiku = config.haiku ? { model: HAIKU_MODEL, mode: config.haiku.mode } : null;
  return reviewsToVerify(db, MODEL, config.mode, pairs, haiku);
}

/**
 * Verifica una revisión: pregunta al modelo (o reusa el veredicto guardado de este modelo) y, en modo live, acepta
 * o rechaza. Una aceptación vetada por `compare()` queda pendiente con sus vetos a la vista.
 */
export async function verifyReview(db: Db, ai: Ai, reviewId: number, config: VerifyConfig, now: Date, log: Logger) {
  const pair = await loadPair(db, reviewId);
  if (!pair || pair.status !== "pending") return "skipped";

  const cached = pair.ai?.model === MODEL ? pair.ai : null;
  const judgement = cached ? { ...cached, neurons: 0 } : await judge(ai, pair.listing, pair.candidate);
  const evidence: AiEvidence = {
    model: judgement.model,
    pAB: judgement.pAB,
    pBA: judgement.pBA,
    verdict: judgement.verdict,
    neurons: judgement.neurons,
    mode: config.mode,
    at: now.toISOString(),
  };

  // Lo que Gemma no decidió: segunda opinión de Haiku (#149), una sola vez por par y dentro del tope diario. Reemplaza
  // al desempate con Clef, que costaba 16 neurons por par y resolvía menos.
  let decidedBy = `ai:${MODEL}`;
  if (config.haiku && evidence.verdict === "pending") {
    const h = config.haiku;
    let opinion = cached?.haiku?.model === HAIKU_MODEL ? { ...cached.haiku, mode: h.mode } : undefined;
    if (!opinion && (await haikuBudgetLeft(db, h, now)) >= USD_PER_PAIR) {
      const record = (call: HaikuCall) =>
        recordUsage(db, {
          at: evidence.at,
          purpose: "judge",
          model: HAIKU_MODEL,
          review_id: reviewId,
          input_tokens: call.inputTokens,
          cache_read_tokens: call.cacheReadTokens,
          cache_write_tokens: call.cacheWriteTokens,
          output_tokens: call.outputTokens,
          usd: call.usd,
          ms: call.ms,
          status: call.status,
          error: call.error,
        });
      try {
        const asked = await haikuOpinion(h.create, pair.listing, pair.candidate, record);
        opinion = { ...asked, mode: h.mode, at: evidence.at };
      } catch (error) {
        // Sin crédito, límite de tasa o API caída: el par queda pendiente y lo retoma la próxima corrida.
        log.warn("haiku.failed", { reviewId, error });
      }
    }
    if (opinion) {
      evidence.haiku = opinion;
      if (h.mode === "live" && opinion.verdict !== "pending") {
        evidence.verdict = opinion.verdict;
        decidedBy = `ai:${HAIKU_MODEL}`;
      }
    }
  }

  // reject: sólo rechaza, que deja un duplicado; aceptar mezcla precios y espera la auditoría de las pendientes reales.
  const applies =
    config.mode === "live" ? evidence.verdict !== "pending" : config.mode === "reject" && evidence.verdict === "reject";
  // La guarda sólo frena aceptaciones: rechazar deja un duplicado, que es el error barato.
  const guard = evidence.verdict === "accept" ? acceptGuard(pair.listing, pair.candidate) : { ok: true as const };
  if (!guard.ok) evidence.guard = guard.reason;
  if (applies && evidence.verdict !== "pending" && guard.ok) {
    const result = await resolveMatchReview(db, {
      reviewId,
      action: evidence.verdict,
      decidedBy,
      now: evidence.at,
    });
    if (result.status === "vetoed") evidence.vetoes = result.vetoes;
  }
  await saveAiEvidence(db, reviewId, evidence);
  log.info("review.verified", { reviewId, ...evidence });
  return evidence.verdict;
}
