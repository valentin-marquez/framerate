import { readFileSync } from "node:fs";
import gold from "../../ingest/src/features/ingestion/domain/match-gold.json";
import { acceptGuard } from "../src/guard";
import { createHaiku, haikuOpinion } from "../src/haiku";
import { type Side, verdictFor } from "../src/judge";
import recorded from "../test/gold-recorded.json";

// Mide la tercera opinión de Haiku contra match-gold.json antes de dejarla decidir (#149). Gasta unos $0,20.
// La clave se lee de apps/match/.dev.vars (ignorado por git), nunca del chat:
//   bun scripts/haiku-gold.ts
const vars = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8");
const apiKey = vars.match(/^ANTHROPIC_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY en apps/match/.dev.vars");
const create = createHaiku(apiKey);

const side = (s: { rawTitle: string; brand: string | null; mpn: string | null }): Side => ({
  title: s.rawTitle,
  brand: s.brand,
  mpn: s.mpn,
});

type Row = { i: number; label: string; confidence: string; note: string; gemmaPending: boolean; a: Side; b: Side };
const rows: Row[] = gold.map((g, i) => {
  const r = recorded[i];
  return {
    i,
    label: g.label,
    confidence: g.confidence,
    note: g.note,
    gemmaPending: !!r && verdictFor(r.pAB, r.pBA) === "pending",
    a: side(g.a),
    b: side(g.b),
  };
});

const results: (Row & { verdict: string; ab: string; ba: string; reason: string; guard: boolean; usd: number })[] = [];
let next = 0;
async function worker() {
  while (next < rows.length) {
    const row = rows[next++];
    if (!row) return;
    try {
      const o = await haikuOpinion(create, row.a, row.b);
      results.push({ ...row, ...o, guard: acceptGuard(row.a, row.b).ok });
    } catch (error) {
      console.error(`par ${row.i}:`, (error as Error).message);
    }
  }
}
await Promise.all(Array.from({ length: 5 }, worker));

function report(name: string, set: typeof results) {
  const of = (label: string, verdict: string, guarded = false) =>
    set.filter((r) => r.label === label && r.verdict === verdict && (!guarded || r.guard)).length;
  const same = set.filter((r) => r.label === "same").length;
  const diff = set.filter((r) => r.label === "different").length;
  console.log(`\n${name}: ${set.length} pares (${same} iguales, ${diff} distintos)`);
  console.log(`  iguales aceptados: ${of("same", "accept")} (${of("same", "accept", true)} tras la guarda)`);
  console.log(`  iguales rechazados: ${of("same", "reject")}  pendientes: ${of("same", "pending")}`);
  console.log(
    `  distintos aceptados (fusión errónea): ${of("different", "accept")}, tras la guarda: ${of("different", "accept", true)}`,
  );
  console.log(`  distintos rechazados: ${of("different", "reject")}  pendientes: ${of("different", "pending")}`);
}

const high = results.filter((r) => r.confidence === "high");
report("Gold, confianza alta", high);
report(
  "Donde Gemma dudó (lo que Haiku vería en producción)",
  high.filter((r) => r.gemmaPending),
);
console.log(`\nCosto: $${results.reduce((s, r) => s + r.usd, 0).toFixed(4)} en ${results.length} pares`);
for (const r of results.filter((r) => r.label === "different" && r.verdict === "accept")) {
  console.log(
    `\nFUSIÓN ERRÓNEA [${r.confidence}] ${r.note}\n  a: ${r.a.title}\n  b: ${r.b.title}\n  motivo: ${r.reason}  guarda: ${r.guard ? "pasa" : "frena"}`,
  );
}
