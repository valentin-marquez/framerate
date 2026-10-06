import { ACCEPT_AT, MODEL, pSameFrom, REJECT_BELOW } from "../src/judge";

// Itera el prompt de sistema de Gemma sobre el gold (#117). Worker local con el binding AI.
//   bunx wrangler dev -c scripts/wrangler.gemma.jsonc ; curl "http://127.0.0.1:8796/?v=g1,g2" -d @/ruta/.claude/gold-todos.json
const IN = 9091 / 1e6;
const OUT = 27273 / 1e6;
const BASE =
  "You compare two PC component listings from Chilean stores. Answer with exactly one word: same or different. " +
  "Same means exactly the same product: same model, model suffix, revision, capacity, color, RGB or not, and edition. " +
  "Any of those differing means different.";
const REGLAS =
  "You compare two PC component listings from Chilean stores (Spanish titles). Answer with exactly one word: same or different. " +
  "Same means the two listings sell the exact same retail product (same SKU). " +
  "Ignore store wording: marketing phrases, shipping notes, intended use, packaging and word order. " +
  "Different means a conflict in any of: model or model suffix (X3D, Super, Ti, XT, GM, M), revision (R2, V2, AC), capacity, memory generation (DDR4/DDR5), ECC or not, SO-DIMM or DIMM, kit size, color, RGB or not, edition. " +
  "If both listings share the same manufacturer part number, they are the same product even if the titles differ.";
const OMITE_OK =
  " If one title simply omits a detail the other states, that is not a conflict unless the omitted detail changes the product line (for example RGB versions exist for the same name).";
const OMITE_NO =
  " If one title omits a model suffix, revision, memory generation or color that the other states, treat them as different unless they share the same manufacturer part number.";
const SYSTEMS: Record<string, string> = { g1: BASE, g2: REGLAS + OMITE_OK, g3: REGLAS, g4: REGLAS + OMITE_NO };

type Par = { id: string; label: "same" | "different"; a: unknown; b: unknown };

async function ask(
  ai: Ai,
  system: string,
  a: unknown,
  b: unknown,
  intento = 0,
): Promise<{ p: number; neurons: number }> {
  try {
    return await askOnce(ai, system, a, b);
  } catch (e) {
    if (intento >= 3) throw e;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** intento));
    return ask(ai, system, a, b, intento + 1);
  }
}

async function askOnce(ai: Ai, system: string, a: unknown, b: unknown) {
  const r = (await ai.run(
    MODEL as never,
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ a, b }) },
      ],
      max_tokens: 8,
      temperature: 0,
      logprobs: true,
      top_logprobs: 5,
      chat_template_kwargs: { enable_thinking: false },
    } as never,
  )) as { usage?: { prompt_tokens?: number; completion_tokens?: number; neurons?: number } };
  const u = r.usage;
  const neurons =
    typeof u?.neurons === "number" ? u.neurons : (u?.prompt_tokens ?? 0) * IN + (u?.completion_tokens ?? 0) * OUT;
  return { p: pSameFrom(r as never), neurons };
}

export default {
  async fetch(req: Request, env: { AI: Ai }) {
    const names = (new URL(req.url).searchParams.get("v") ?? "g2").split(",");
    const pares = (await req.json()) as Par[];
    const out: string[] = [];
    for (const name of names) {
      const system = SYSTEMS[name];
      if (!system) continue;
      const res: { p: Par; lo: number; hi: number }[] = [];
      let neurons = 0;
      for (const p of pares) {
        const x = await ask(env.AI, system, p.a, p.b);
        const y = await ask(env.AI, system, p.b, p.a);
        neurons += x.neurons + y.neurons;
        res.push({ p, lo: Math.min(x.p, y.p), hi: Math.max(x.p, y.p) });
      }
      const same = res.filter((r) => r.p.label === "same");
      const diff = res.filter((r) => r.p.label === "different");
      const accepts = (r: { lo: number }, t: number) => r.lo >= t;
      const rejects = (r: { hi: number }) => r.hi < REJECT_BELOW;
      out.push(`== ${name}: ${(neurons / pares.length).toFixed(2)} neurons por par`);
      for (const t of [ACCEPT_AT, 0.8, 0.7]) {
        const fm = diff.filter((r) => accepts(r, t)).map((r) => r.p.id);
        out.push(
          `  umbral ${t}: mismo aceptados ${same.filter((r) => accepts(r, t)).length}/${same.length}, fusiones erróneas ${fm.length}/${diff.length} [${fm.join(" ")}]`,
        );
      }
      const wrongReject = same.filter(rejects).map((r) => r.p.id);
      out.push(
        `  rechaza ${diff.filter(rejects).length}/${diff.length} distintos, rechazos erróneos ${wrongReject.length} [${wrongReject.join(" ")}]`,
      );
      const resueltos = res.filter((r) => accepts(r, ACCEPT_AT) || rejects(r)).length;
      out.push(`  resuelve solo (0,9): ${resueltos}/${res.length}`);
    }
    return new Response(out.join("\n"));
  },
};
