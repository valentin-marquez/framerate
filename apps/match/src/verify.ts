import type { Db } from "@framerate/database";
import type { Logger } from "@framerate/kit";
import { resolveMatchReview } from "@framerate/matching";
import { acceptGuard } from "./guard";
import { judge, MODEL } from "./judge";
import { type AiEvidence, loadPair, neuronsSpentSince, reviewsToVerify, saveAiEvidence } from "./reviews.repository";
import { needsTiebreak, tiebreak } from "./tiebreak";

// Estimación por par para repartir el presupuesto: 2,5 de Gemma medidos, más el desempate con Clef (16) que sale
// en una fracción de los pares. El tope diario se respeta igual porque el barrido mide lo gastado antes de encolar.
const NEURONS_PER_PAIR = 6;

export interface VerifyConfig {
  mode: "shadow" | "reject" | "live";
  dailyNeurons: number;
}

/**
 * Cuántas revisiones caben hoy en el presupuesto, y cuáles. `spentExtra` son los neurons gastados en esta misma
 * corrida que todavía no están en `match_reviews` (la extracción de modelos de #98): sin descontarlos, el tope
 * diario se pasaría.
 */
export async function reviewsForToday(db: Db, config: VerifyConfig, now: Date, spentExtra = 0): Promise<number[]> {
  const startOfDay = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const left = config.dailyNeurons - (await neuronsSpentSince(db, startOfDay)) - spentExtra;
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

  // Gemma que se contradice según el orden no es ruido: en el set etiquetado, 5 de 17 de esos pares son productos
  // distintos. Clef los separa bien, así que desempata, y sólo para aceptar (ver tiebreak.ts).
  if (evidence.verdict === "pending" && needsTiebreak(evidence.pAB, evidence.pBA) && !cached?.tiebreak) {
    const second = await tiebreak(ai, pair.listing, pair.candidate);
    evidence.neurons += second.neurons;
    evidence.tiebreak = { model: second.model, pAB: second.pAB, pBA: second.pBA, same: second.same };
    if (second.same) evidence.verdict = "accept";
  } else if (cached?.tiebreak) {
    evidence.tiebreak = cached.tiebreak;
    if (cached.tiebreak.same) evidence.verdict = "accept";
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
      decidedBy: `ai:${MODEL}`,
      now: evidence.at,
    });
    if (result.status === "vetoed") evidence.vetoes = result.vetoes;
  }
  await saveAiEvidence(db, reviewId, evidence);
  log.info("review.verified", { reviewId, ...evidence });
  return evidence.verdict;
}
