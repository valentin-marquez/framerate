// Itera el prompt de Clef sobre un set chico de pares difíciles (#117). Worker local con el binding AI.
//   bunx wrangler dev -c scripts/wrangler.clef.jsonc ; curl "localhost:8795/?v=v1,v2,v3" -d @../../.claude/clef-subset.json
const PRICE = 21818 / 1e6;
const BASE =
  "Are these two listings exactly the same product, with the same variant, model and color? Different capacity, model suffix, color or edition means they are different products.";
const REGLAS =
  "Decide whether the two listings sell the exact same retail product (same SKU). Spanish-language titles from Chilean stores. " +
  "Ignore store wording: marketing phrases, shipping notes, intended use, packaging and word order. " +
  "Different means a conflict in any of: model or model suffix (X3D, Super, Ti, XT, GM, M), revision (R2, V2, AC), capacity, memory generation (DDR4/DDR5), ECC or not, SO-DIMM or DIMM, kit size, color, RGB or not, edition. " +
  "If both listings share the same manufacturer part number, they are the same product even if the titles differ. " +
  "If one title simply omits a detail the other states, that is not a conflict unless the omitted detail changes the product line (for example RGB versions exist for the same name).";
const CONFLICTO =
  "Do the two listings state a conflicting value for any of: model suffix, revision, capacity, memory generation, ECC, form factor, color, RGB, edition? A detail that appears in only one title is not a conflict.";

type Q = Record<string, { type: "noul"; instructions: string }>;
const VARIANTS: Record<string, { questions: Q; score: (a: Record<string, number>) => number }> = {
  v1: { questions: { r: { type: "noul", instructions: BASE } }, score: (a) => a.r ?? 0.5 },
  v2: { questions: { r: { type: "noul", instructions: REGLAS } }, score: (a) => a.r ?? 0.5 },
  v3: {
    questions: {
      mismo: {
        type: "noul",
        instructions: "Do these two listings refer to the same product line and model (ignoring variants)?",
      },
      conflicto: { type: "noul", instructions: CONFLICTO },
    },
    score: (a) => Math.min(a.mismo ?? 0.5, 1 - (a.conflicto ?? 0.5)),
  },
};

type Par = { id: string; label: "same" | "different"; a: unknown; b: unknown; base: number; note: string };

async function ask(ai: Ai, state: unknown, v: (typeof VARIANTS)[string]) {
  const r = (await ai.run("@cf/cloudflare/clef" as never, { state, questions: v.questions } as never)) as {
    answers?: Record<string, { noul?: number }>;
    usage?: { input_tokens?: number };
  };
  const flat = Object.fromEntries(Object.entries(r.answers ?? {}).map(([k, x]) => [k, x.noul ?? 0.5]));
  return { s: v.score(flat), neurons: (r.usage?.input_tokens ?? 300) * PRICE };
}

export default {
  async fetch(req: Request, env: { AI: Ai }) {
    const names = (new URL(req.url).searchParams.get("v") ?? "v2").split(",");
    const pares = (await req.json()) as Par[];
    const out: string[] = [];
    for (const name of names) {
      const v = VARIANTS[name];
      if (!v) continue;
      const res: { p: Par; s: number }[] = [];
      let neurons = 0;
      for (const p of pares) {
        const x = await ask(env.AI, { a: p.a, b: p.b }, v);
        const y = await ask(env.AI, { a: p.b, b: p.a }, v);
        neurons += x.neurons + y.neurons;
        res.push({ p, s: Math.min(x.s, y.s) });
      }
      const same = res.filter((r) => r.p.label === "same");
      const diff = res.filter((r) => r.p.label === "different");
      out.push(`== ${name}: ${(neurons / pares.length).toFixed(1)} neurons por par`);
      for (const t of [0.9, 0.8, 0.7, 0.5]) {
        const fm = diff.filter((r) => r.s >= t).map((r) => r.p.id);
        out.push(
          `  umbral ${t}: mismo aceptados ${same.filter((r) => r.s >= t).length}/${same.length}, fusiones erróneas ${fm.length}/${diff.length} [${fm.join(" ")}]`,
        );
      }
      out.push(
        `  (línea base v1 viene de gold: mismo>=0,9 = ${same.filter((r) => r.p.base >= 0.9).length}/${same.length}, distintos>=0,9 = ${diff.filter((r) => r.p.base >= 0.9).length})`,
      );
    }
    return new Response(out.join("\n"));
  },
};
