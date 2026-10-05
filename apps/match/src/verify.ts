import type { Db } from "@framerate/database";
import type { Logger } from "@framerate/kit";
import { resolveMatchReview } from "@framerate/matching";
import { judge, MODEL } from "./judge";
import { type AiEvidence, loadPair, neuronsSpentSince, reviewsToVerify, saveAiEvidence } from "./reviews.repository";

// ponytail: estimación fija por par (medido ~2,5 con títulos del set); si los reales salen más largos, el tope
// diario se respeta igual porque el barrido mide lo gastado antes de encolar.
const NEURONS_PER_PAIR = 3;

export interface VerifyConfig {
  mode: "shadow" | "live";
  dailyNeurons: number;
}

/** Cuántas revisiones caben hoy en el presupuesto, y cuáles. */
export async function reviewsForToday(db: Db, config: VerifyConfig, now: Date): Promise<number[]> {
  const startOfDay = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const left = config.dailyNeurons - (await neuronsSpentSince(db, startOfDay));
  const pairs = Math.floor(left / NEURONS_PER_PAIR);
  if (pairs <= 0) return [];
  return reviewsToVerify(db, MODEL, config.mode, pairs);
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

  if (config.mode === "live" && evidence.verdict !== "pending") {
    const result = await resolveMatchReview(db, {
      reviewId,
      action: evidence.verdict,
      decidedBy: `ai:${MODEL}`,
      now: evidence.at,
    });
    if (result.status === "vetoed") evidence.vetoes = result.vetoes;
  }
  await saveAiEvidence(db, reviewId, evidence);
  log.info("review.verified", { reviewId, ...evidence });
  return evidence.verdict;
}
