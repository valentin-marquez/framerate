import type { Side } from "./judge";

/**
 * Desempate con Clef para los pares donde Gemma se contradice según el orden (#148).
 *
 * Medido el 08-10-2026: de las 120 revisiones que quedaban para una persona, 79 eran de este tipo, y mirándolas son
 * casi todas el mismo producto escrito distinto ("9800X 3D" contra "9800X3D", "VP-700" contra "VP700"). Aflojar el
 * umbral de Gemma no sirve: en el set etiquetado, 5 de 17 pares asimétricos son productos realmente distintos, así
 * que la asimetría es la señal de que el par es difícil, no ruido.
 *
 * Clef sí los separa. Medido en los dos sets, preguntando en los dos órdenes:
 *
 * | Umbral | Gold (12 iguales, 5 distintos) | Producción (23 iguales, 4 distintos) |
 * |---|---|---|
 * | 0,9 | 5 de 12, 0 erróneas | 8 de 23, 0 erróneas |
 * | 0,8 | 9 de 12, 0 erróneas | 23 de 23, 1 que la guarda frena |
 * | 0,7 | 12 de 12, 0 erróneas | 23 de 23, 1 que la guarda frena |
 *
 * Se eligió 0,8: resuelve casi todo y ningún par distinto llega ahí sin que la guarda lo pare. Sólo sirve para
 * aceptar: en los distintos Clef no baja lo suficiente como para rechazar con confianza (0,30 y 0,83 en un par
 * distinto del gold), así que rechazar se queda en manos de Gemma y de la persona.
 */
export const TIEBREAK_MODEL = "@cf/cloudflare/clef";
export const TIEBREAK_AT = 0.8;
/** Cuánto tienen que discrepar los dos órdenes de Gemma para que valga la pena preguntar. */
export const DISAGREE_OVER = 0.5;
/** Medido: 15,5 a 16,1 neurons por par (dos preguntas). */
export const NEURONS_PER_TIEBREAK = 16;

const INSTRUCTIONS =
  "Decide whether the two listings sell the exact same retail product (same SKU). Spanish-language titles from " +
  "Chilean stores. Ignore store wording: marketing phrases, shipping notes, intended use, packaging and word order. " +
  "Different means a conflict in any of: model or model suffix (X3D, Super, Ti, XT, GM, M, CSM, MLG), revision " +
  "(R2, V2, AC), capacity, memory generation (DDR4/DDR5), ECC or not, SO-DIMM or DIMM, kit size, color, RGB or " +
  "not, edition. If both listings share the same manufacturer part number, they are the same product.";

export interface Tiebreak {
  model: string;
  pAB: number;
  pBA: number;
  neurons: number;
  same: boolean;
}

/** ¿Vale la pena desempatar? Sólo cuando Gemma no decidió y sus dos órdenes se contradicen. */
export function needsTiebreak(pAB: number, pBA: number): boolean {
  return Math.abs(pAB - pBA) > DISAGREE_OVER;
}

async function ask(ai: Ai, a: Side, b: Side) {
  const response = (await ai.run(
    TIEBREAK_MODEL as Parameters<Ai["run"]>[0],
    { state: { a, b }, questions: { r: { type: "noul", instructions: INSTRUCTIONS } } } as never,
  )) as { answers?: Record<string, { noul?: number }>; usage?: { input_tokens?: number } };
  // Sin respuesta, 0,5 deja el par donde estaba.
  return { p: response.answers?.r?.noul ?? 0.5, tokens: response.usage?.input_tokens ?? 0 };
}

const PRICE_PER_TOKEN = 21818 / 1e6;

export async function tiebreak(ai: Ai, listing: Side, candidate: Side): Promise<Tiebreak> {
  const [x, y] = [await ask(ai, listing, candidate), await ask(ai, candidate, listing)];
  const neurons = (x.tokens + y.tokens) * PRICE_PER_TOKEN || NEURONS_PER_TIEBREAK;
  return {
    model: TIEBREAK_MODEL,
    pAB: x.p,
    pBA: y.p,
    neurons,
    same: Math.min(x.p, y.p) >= TIEBREAK_AT,
  };
}
