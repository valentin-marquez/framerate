import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import type { Category } from "@framerate/contracts";
import { createNormalizer, normalizeWithHaiku } from "@framerate/matching/normalize";
import gold from "../../ingest/src/features/ingestion/domain/match-gold.json";
import {
  type GoldPair,
  identityFingerprint,
  type NormalizedSide,
  outcome,
  regexFingerprint,
  sideKey,
} from "../test/gold-identity";

// Normaliza los lados de match-gold.json con Haiku (prompt, esquema y anclaje reales) y graba
// test/gold-normalized.json (#153, fase 0). 758 lados únicos, ~$0,30. La clave se lee de apps/match/.dev.vars:
//   bun scripts/normalizar-gold.ts          RESUME=1 conserva lo ya grabado; HARD_CAP_USD tope de gasto (1.2)
const vars = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8");
const apiKey = vars.match(/^ANTHROPIC_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY en apps/match/.dev.vars");
const create = createNormalizer(apiKey);
const HARD_CAP_USD = Number(process.env.HARD_CAP_USD ?? 1.2);
const OUT = new URL("../test/gold-normalized.json", import.meta.url);

const pairs = gold as GoldPair[];
const done = new Map<string, NormalizedSide>();
if (process.env.RESUME && existsSync(OUT)) {
  for (const s of JSON.parse(readFileSync(OUT, "utf8")) as NormalizedSide[]) done.set(sideKey(s.category, s), s);
}
const pending = new Map<string, NormalizedSide>();
for (const pair of pairs) {
  for (const side of [pair.a, pair.b]) {
    const key = sideKey(pair.category, side);
    if (done.has(key) || pending.has(key)) continue;
    const { rawTitle, brand, mpn, gtin } = side;
    pending.set(key, { category: pair.category as Category, rawTitle, brand, mpn, gtin, status: "invalid", out: null });
  }
}
// Por categoría: la caché del prompt incluye el esquema, así todo salvo la primera llamada de cada una es lectura.
const byCategory = Map.groupBy(pending.values(), (s) => s.category);

let spent = 0;
let calls = 0;
const tokens = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
const ms: number[] = [];
const save = () => writeFileSync(OUT, `${JSON.stringify([...done.values()], null, 2)}\n`);

async function normalize(side: NormalizedSide, attempt = 0): Promise<void> {
  if (spent >= HARD_CAP_USD) throw new Error(`Tope de gasto alcanzado: $${spent.toFixed(4)}`);
  try {
    const r = await normalizeWithHaiku(create, {
      category: side.category,
      title: side.rawTitle,
      brand: side.brand,
      mpn: side.mpn,
      gtin: side.gtin,
    });
    spent += r.usd;
    calls += r.calls;
    ms.push(r.ms);
    for (const k of Object.keys(tokens) as (keyof typeof tokens)[]) tokens[k] += r.usage[k];
    const out = r.output;
    done.set(sideKey(side.category, side), {
      ...side,
      status: r.status,
      out: out && {
        category: out.category,
        brand: out.brand,
        name: out.name,
        mpn: out.mpn,
        confidence: out.confidence,
        identity: out.identity,
        identity_from_mpn: out.identity_from_mpn,
        identity_from_knowledge: out.identity_from_knowledge,
      },
    });
    if (r.status !== "ok") console.error(`  ${r.status}: ${side.rawTitle} (${r.error})`);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 5_000 * 2 ** attempt));
      return normalize(side, attempt + 1);
    }
    throw error;
  }
}

try {
  for (const [category, sides] of byCategory) {
    console.log(`${category}: ${sides.length} lados`);
    const [first, ...rest] = sides;
    if (first) await normalize(first);
    let next = 0;
    const worker = async () => {
      while (next < rest.length) {
        const side = rest[next++];
        if (side) await normalize(side);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    save();
  }
} catch (error) {
  // Un error de la API (clave, crédito, tope) se repite en todos los lados: se guarda lo hecho y se corta.
  save();
  console.error((error as Error).message);
  process.exit(1);
}

// ─── Reporte ─────────────────────────────────────────────────────────────────

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
console.log(
  `\nLlamadas ${calls}  gasto $${spent.toFixed(4)}  tokens in ${tokens.inputTokens} out ${tokens.outputTokens} cacheRead ${tokens.cacheReadTokens} cacheWrite ${tokens.cacheWriteTokens}  latencia media ${ms.length ? Math.round(sum(ms) / ms.length) : 0} ms`,
);

type Count = { sides: number; returned: number; anchored: number; dropped: number; fromMpn: number; knowledge: number };
const perCategory = new Map<string, Count>();
const droppedFields = new Map<string, number>();
for (const side of done.values()) {
  const c = perCategory.get(side.category) ?? {
    sides: 0,
    returned: 0,
    anchored: 0,
    dropped: 0,
    fromMpn: 0,
    knowledge: 0,
  };
  c.sides++;
  const { anchored } = identityFingerprint(side);
  if (anchored) {
    c.returned += Object.keys(anchored.identity).length + anchored.dropped.length;
    c.anchored += Object.keys(anchored.identity).length;
    c.dropped += anchored.dropped.length;
    c.fromMpn += anchored.fromMpn.length;
    c.knowledge += anchored.knowledge.length;
    for (const f of anchored.dropped) {
      const k = `${side.category}.${f}`;
      droppedFields.set(k, (droppedFields.get(k) ?? 0) + 1);
    }
  }
  perCategory.set(side.category, c);
}
console.log("\nCampos de identidad por categoría (lados únicos):");
for (const [category, c] of perCategory) {
  console.log(
    `  ${category.padEnd(12)} lados ${String(c.sides).padStart(3)}  devueltos ${String(c.returned).padStart(4)}  anclados ${String(c.anchored).padStart(4)}  descartados ${String(c.dropped).padStart(3)}  por MPN ${String(c.fromMpn).padStart(3)}  knowledge ${c.knowledge}`,
  );
}
console.log(
  "Descartados por campo:",
  [...droppedFields]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(", "),
);

const sure = pairs.filter((p) => p.confidence === "high");
const fp = (pair: GoldPair, side: GoldPair["a"]) => {
  const recorded = done.get(sideKey(pair.category, side));
  return recorded ? identityFingerprint(recorded).fingerprint : null;
};
const kindOf = (d: ReturnType<typeof outcome>) => (d === "missing" ? "missing" : d.kind);
const identityOutcome = (p: GoldPair) => outcome(fp(p, p.a), fp(p, p.b), p.a.store === p.b.store);
const regexOutcome = (p: GoldPair) =>
  outcome(
    regexFingerprint(p.category as Category, p.a),
    regexFingerprint(p.category as Category, p.b),
    p.a.store === p.b.store,
  );
for (const [name, decideFor] of [
  ["identidad anclada", identityOutcome],
  ["regex sobre el mismo título", regexOutcome],
] as const) {
  const wrong = sure.filter((p) => p.label === "different" && kindOf(decideFor(p)) === "link");
  const same = sure.filter((p) => p.label === "same");
  const linked = same.filter((p) => kindOf(decideFor(p)) === "link").length;
  const review = same.filter((p) => kindOf(decideFor(p)) === "review").length;
  console.log(`\n${name}: fusiones erróneas ${wrong.length}  recall ${linked}/${same.length}  (a revisión ${review})`);
  for (const p of wrong) {
    const d = decideFor(p);
    console.log(`  FUSIÓN ERRÓNEA ${p.category} [${p.note}]\n    a: ${p.a.rawTitle}\n    b: ${p.b.rawTitle}`);
    if (d !== "missing" && d.kind !== "new_product") console.log(`    ${JSON.stringify(d.comparison.evidence)}`);
  }
}
