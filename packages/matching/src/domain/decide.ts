import { PROFILES } from "./attributes";
import type { Fingerprint } from "./fingerprint";

/**
 * Comparación y decisión de matching. Lógica pura y determinista.
 *
 * Regla de oro: **preferimos duplicados antes que fusiones erróneas.** Un
 * duplicado se arregla después (revisión); una fusión errónea mezcla precios
 * de productos distintos y nadie se entera.
 */

export interface Comparison {
  score: number;
  /** Razones que prueban que NO son el mismo producto. Si hay alguna, score = 0. */
  vetoes: string[];
  evidence: {
    identifier?: "mpn" | "gtin";
    mpnConflict?: boolean;
    /** Códigos de modelo con el mismo prefijo y distinto número ("nv1" vs "nv3", "cl36" vs "cl28"). */
    modelConflict?: boolean;
    attributeKeyMatch?: boolean;
    titleSimilarity: number;
    brandMatch?: boolean;
  };
}

export function compare(offer: Fingerprint, candidate: Fingerprint): Comparison {
  const vetoes: string[] = [];
  const evidence: Comparison["evidence"] = { titleSimilarity: diceSimilarity(offer.tokens, candidate.tokens) };

  if (offer.category !== candidate.category) vetoes.push("category");

  if (offer.brand && candidate.brand) {
    evidence.brandMatch = offer.brand === candidate.brand;
    if (!evidence.brandMatch) vetoes.push("brand");
  }

  for (const field of PROFILES[offer.category].discriminators) {
    const a = offer.attributes[field];
    const b = candidate.attributes[field];
    if (a !== undefined && b !== undefined && a !== b) vetoes.push(`attribute:${field}`);
  }

  if (offer.gtin && candidate.gtin && offer.gtin === candidate.gtin) evidence.identifier = "gtin";
  else if (offer.mpn && candidate.mpn && offer.mpn === candidate.mpn) evidence.identifier = "mpn";
  else if (offer.mpn && candidate.mpn) evidence.mpnConflict = true;
  if (modelCodeConflict(offer.tokens, candidate.tokens)) evidence.modelConflict = true;

  if (offer.attributeKey && candidate.attributeKey) {
    evidence.attributeKeyMatch = offer.attributeKey === candidate.attributeKey;
  }

  if (vetoes.length > 0) return { score: 0, vetoes, evidence };
  if (evidence.identifier) return { score: 0.99, vetoes, evidence };

  let score = 0.35 * evidence.titleSimilarity;
  if (evidence.attributeKeyMatch) score += 0.55;
  if (evidence.brandMatch) score += 0.1;
  // Dos MPN o dos versiones de modelo distintas son señal fuerte en contra (aunque las tiendas a veces publican
  // códigos distintos del mismo producto): nunca fusión automática.
  if (evidence.mpnConflict || evidence.modelConflict) score *= 0.6;

  return { score: round(score), vetoes, evidence };
}

export type Decision =
  | { kind: "link"; productId: number; method: "identifier" | "attributes"; confidence: number; comparison: Comparison }
  | { kind: "review"; productId: number; confidence: number; comparison: Comparison }
  | { kind: "new_product" };

export const THRESHOLDS = {
  /** Fusión automática por atributos en categorías donde la clave NO es única. */
  autoAttributes: 0.85,
  /** Por debajo de esto ni siquiera vale la pena pedir revisión humana. */
  review: 0.6,
} as const;

export interface Candidate {
  productId: number;
  fingerprint: Fingerprint;
  /**
   * El producto ya tiene otra oferta activa de la misma tienda. Una tienda no publica dos veces el mismo producto:
   * si los atributos coinciden, casi siempre es una variante (RGB, color, otra serie), así que va a revisión.
   */
  sameStore?: boolean;
}

/** Elige el mejor candidato y decide qué hacer con la oferta. */
export function decide(offer: Fingerprint, candidates: readonly Candidate[]): Decision {
  let best: { candidate: Candidate; comparison: Comparison } | null = null;
  for (const candidate of candidates) {
    const comparison = compare(offer, candidate.fingerprint);
    if (comparison.vetoes.length > 0) continue;
    if (!best || comparison.score > best.comparison.score) best = { candidate, comparison };
  }
  if (!best) return { kind: "new_product" };

  const { candidate, comparison } = best;
  const { evidence, score } = comparison;
  const profile = PROFILES[offer.category];

  if (evidence.identifier) {
    return { kind: "link", productId: candidate.productId, method: "identifier", confidence: score, comparison };
  }

  if (evidence.attributeKeyMatch && !evidence.mpnConflict && !evidence.modelConflict && !candidate.sameStore) {
    if (profile.keyIsUnique || score >= THRESHOLDS.autoAttributes) {
      return { kind: "link", productId: candidate.productId, method: "attributes", confidence: score, comparison };
    }
  }

  if (score >= THRESHOLDS.review) {
    return { kind: "review", productId: candidate.productId, confidence: score, comparison };
  }
  return { kind: "new_product" };
}

/** Tokens con dígitos que describen especificaciones, no el modelo (una tienda los pone y otra no). */
const SPEC_CODE = /^(g?ddr|pc|gen|pcie|sata|usb|x|m|lga|s?am|fm|s|v|cl|mt|rev)\d/;

/**
 * Hay un código de modelo sólo en un lado y otro sólo en el otro: "nv1" vs "nv3", "p2" vs "t500", "cl36" vs "cl28".
 * Los de especificación sólo cuentan contra otro del mismo prefijo ("gen4" vs "gen5", pero no "gen4" vs "am5").
 */
function modelCodeConflict(a: readonly string[], b: readonly string[]): boolean {
  const codesOnlyIn = (xs: readonly string[], other: readonly string[]) =>
    xs.filter((t) => /^[a-z]+\d/.test(t) && !other.includes(t));
  const prefix = (t: string) => t.match(/^[a-z]+/)?.[0];
  const onlyB = codesOnlyIn(b, a);
  return codesOnlyIn(a, b).some((x) =>
    onlyB.some((y) => prefix(x) === prefix(y) || (!SPEC_CODE.test(x) && !SPEC_CODE.test(y))),
  );
}

/** Coeficiente de Dice sobre conjuntos de tokens (0..1). */
export function diceSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const t of new Set(a)) if (setB.has(t)) shared++;
  return round((2 * shared) / (new Set(a).size + setB.size));
}

const round = (n: number) => Math.round(n * 1000) / 1000;
