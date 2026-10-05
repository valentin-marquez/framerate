export const MODEL = "@cf/google/gemma-4-26b-a4b-it";

// Medido con match-gold.json (#117): con 0,9 en los dos órdenes, 0 fusiones erróneas en 310 pares.
export const ACCEPT_AT = 0.9;
export const REJECT_BELOW = 0.1;

// Tabla de Workers AI al 01-10-2026, por si la respuesta no trae `usage.neurons`.
const NEURONS_PER_INPUT_TOKEN = 9091 / 1e6;
const NEURONS_PER_OUTPUT_TOKEN = 27273 / 1e6;

const SYSTEM =
  "You compare two PC component listings from Chilean stores. Answer with exactly one word: same or different. " +
  "Same means exactly the same product: same model, model suffix, revision, capacity, color, RGB or not, and edition. " +
  "Any of those differing means different.";

export interface Side {
  title: string;
  brand: string | null;
  mpn: string | null;
}

export type Verdict = "accept" | "reject" | "pending";

export interface Judgement {
  model: string;
  pAB: number;
  pBA: number;
  verdict: Verdict;
  neurons: number;
}

/** Acepta o rechaza sólo si los dos órdenes coinciden con margen; el resto queda para una persona. */
export function verdictFor(pAB: number, pBA: number): Verdict {
  if (pAB >= ACCEPT_AT && pBA >= ACCEPT_AT) return "accept";
  if (pAB < REJECT_BELOW && pBA < REJECT_BELOW) return "reject";
  return "pending";
}

interface TopLogprob {
  token: string;
  logprob: number;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; logprobs?: { content?: { top_logprobs?: TopLogprob[] }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; neurons?: number };
}

/** P("same") entre los dos tokens posibles. Sin logprobs no hay umbral: 0,5 deja la revisión para una persona. */
export function pSameFrom(response: ChatResponse): number {
  const top = response.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs;
  if (!top) return 0.5;
  const mass = (prefix: string) =>
    top.filter((t) => t.token.trim().toLowerCase().startsWith(prefix)).reduce((sum, t) => sum + Math.exp(t.logprob), 0);
  const same = mass("same");
  const different = mass("diff");
  return same + different > 0 ? same / (same + different) : 0.5;
}

function neuronsOf(response: ChatResponse): number {
  const u = response.usage;
  if (!u) return 0;
  if (typeof u.neurons === "number") return u.neurons;
  return (u.prompt_tokens ?? 0) * NEURONS_PER_INPUT_TOKEN + (u.completion_tokens ?? 0) * NEURONS_PER_OUTPUT_TOKEN;
}

async function ask(ai: Ai, a: Side, b: Side) {
  const response = (await ai.run(
    MODEL as Parameters<Ai["run"]>[0],
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ a, b }) },
      ],
      max_tokens: 8,
      temperature: 0,
      logprobs: true,
      top_logprobs: 5,
      chat_template_kwargs: { enable_thinking: false },
    } as never,
  )) as ChatResponse;
  return { p: pSameFrom(response), neurons: neuronsOf(response) };
}

/** Pregunta en los dos órdenes: el modelo cambia de opinión al invertirlos en ~5 % de los pares. */
export async function judge(ai: Ai, listing: Side, candidate: Side): Promise<Judgement> {
  const ab = await ask(ai, listing, candidate);
  const ba = await ask(ai, candidate, listing);
  return {
    model: MODEL,
    pAB: ab.p,
    pBA: ba.p,
    verdict: verdictFor(ab.p, ba.p),
    neurons: ab.neurons + ba.neurons,
  };
}
