import gold from "../../ingest/src/features/ingestion/domain/match-gold.json";
import { ACCEPT_AT, judge, type Side } from "../src/judge";

// Cascada Gemma 4 -> Clef (#117): Clef sólo da segunda opinión a lo que Gemma acepta. No toca producción.
// Worker local con el binding AI (usa el login de wrangler, sin token): `bunx wrangler dev -c scripts/wrangler.cascada.jsonc`
//   curl "localhost:8788/?set=gold&limite=50"
//   curl "localhost:8788/?set=reales" -d @../../.claude/aceptadas-gemma.json   (reales: [{ id, listing, candidate, sospechoso? }])
const CLEF_NEURONS_PER_INPUT_TOKEN = 21818 / 1e6;
const CLEF_QUESTION =
  "Are these two listings exactly the same product, with the same variant, model and color? Different capacity, model suffix, color or edition means they are different products.";

type Par = { id: string; a: Side; b: Side; esperado: "same" | "different" | "sospechoso" };

async function clef(ai: Ai, a: Side, b: Side) {
  const ask = async (x: Side, y: Side) => {
    const r = (await ai.run(
      "@cf/cloudflare/clef" as never,
      {
        state: { a: x, b: y },
        questions: { respuesta: { type: "noul", instructions: CLEF_QUESTION } },
      } as never,
    )) as { answers?: { respuesta?: { noul?: number } }; usage?: { input_tokens?: number } };
    return {
      p: r.answers?.respuesta?.noul ?? 0.5,
      neurons: (r.usage?.input_tokens ?? 260) * CLEF_NEURONS_PER_INPUT_TOKEN,
    };
  };
  const ab = await ask(a, b);
  const ba = await ask(b, a);
  return { pAB: ab.p, pBA: ba.p, neurons: ab.neurons + ba.neurons };
}

function paresGold(): Par[] {
  const side = (s: { rawTitle: string; brand: string | null; mpn: string | null }): Side => ({
    title: s.rawTitle,
    brand: s.brand,
    mpn: s.mpn,
  });
  return gold
    .filter((p) => p.confidence === "high" && p.label !== "unsure")
    .map((p, i) => ({ id: String(i), a: side(p.a), b: side(p.b), esperado: p.label as "same" | "different" }));
}

const ok = (pAB: number, pBA: number, t: number) => pAB >= t && pBA >= t;

export default {
  async fetch(req: Request, env: { AI: Ai }) {
    const url = new URL(req.url);
    const set = url.searchParams.get("set") ?? "gold";
    const limite = Number(url.searchParams.get("limite") ?? "1000");
    const pares: Par[] =
      set === "gold"
        ? paresGold()
        : ((await req.json()) as { id: number; listing: string; candidate: string; sospechoso?: boolean }[]).map(
            (r) => ({
              id: String(r.id),
              a: { title: r.listing, brand: null, mpn: null },
              b: { title: r.candidate, brand: null, mpn: null },
              esperado: r.sospechoso ? "sospechoso" : "same",
            }),
          );

    const filas: {
      id: string;
      esperado: string;
      g: Awaited<ReturnType<typeof judge>>;
      c?: Awaited<ReturnType<typeof clef>>;
    }[] = [];
    for (const par of pares.slice(0, limite)) {
      const g = await judge(env.AI, par.a, par.b);
      const c = set === "gold" || g.verdict === "accept" ? await clef(env.AI, par.a, par.b) : undefined;
      filas.push({ id: par.id, esperado: par.esperado, g, c });
      console.log(
        par.id,
        par.esperado,
        g.verdict,
        g.pAB.toFixed(2),
        g.pBA.toFixed(2),
        c ? `${c.pAB.toFixed(2)} ${c.pBA.toFixed(2)}` : "",
      );
    }

    const malo = (e: string) => e !== "same";
    const gemmaAcepta = filas.filter((f) => f.g.verdict === "accept");
    const neuronsGemma = filas.reduce((s, f) => s + f.g.neurons, 0);
    const neuronsClef = gemmaAcepta.reduce((s, f) => s + (f.c?.neurons ?? 0), 0);
    const out = [
      `Pares: ${filas.length}`,
      `Gemma sola: acepta ${gemmaAcepta.length}, fusiones erróneas ${gemmaAcepta.filter((f) => malo(f.esperado)).length}, neurons por par ${(neuronsGemma / filas.length).toFixed(2)}`,
    ];
    for (const t of [ACCEPT_AT, 0.8, 0.5]) {
      const casc = gemmaAcepta.filter((f) => f.c && ok(f.c.pAB, f.c.pBA, t));
      out.push(
        `Cascada (Clef >= ${t}): acepta ${casc.length}, fusiones erróneas ${casc.filter((f) => malo(f.esperado)).length}, neurons por par ${((neuronsGemma + neuronsClef) / filas.length).toFixed(2)}`,
      );
    }
    if (set === "gold") {
      const solo = filas.filter((f) => f.c && ok(f.c.pAB, f.c.pBA, ACCEPT_AT));
      out.push(`Clef solo: acepta ${solo.length}, fusiones erróneas ${solo.filter((f) => malo(f.esperado)).length}`);
    }
    out.push(
      `Gemma aceptó y Clef frenó (0,9): ${gemmaAcepta
        .filter((f) => f.c && !ok(f.c.pAB, f.c.pBA, ACCEPT_AT))
        .map((f) => `${f.id}${malo(f.esperado) ? "*" : ""}`)
        .join(" ")} (* = sospechoso o distinto)`,
    );
    return new Response(`${out.join("\n")}\n\n${JSON.stringify(filas)}`);
  },
};
