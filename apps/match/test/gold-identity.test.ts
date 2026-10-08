import { expect, test } from "bun:test";
import gold from "../../ingest/src/features/ingestion/domain/match-gold.json";
import { type GoldPair, identityFingerprint, type NormalizedSide, outcome, sideKey } from "./gold-identity";
import normalizedJson from "./gold-normalized.json";

// Segunda pasada del gold (#153, fase 0): `decide()` sobre la identidad de Haiku anclada, grabada con
// scripts/normalizar-gold.ts para no gastar en cada test. Si cambian el prompt, el esquema o el gold, regrabar.
const pairs = gold as GoldPair[];
// El JSON infiere una unión enorme por campo que TypeScript no compara con el tipo.
const normalized = new Map((normalizedJson as unknown as NormalizedSide[]).map((s) => [sideKey(s.category, s), s]));

const fingerprintOf = (pair: GoldPair, side: GoldPair["a"]) => {
  const recorded = normalized.get(sideKey(pair.category, side));
  if (!recorded) throw new Error(`gold-normalized.json no tiene "${side.rawTitle}": regrabar`);
  return identityFingerprint(recorded).fingerprint;
};

const rows = pairs.map((pair) => ({
  pair,
  decision: outcome(fingerprintOf(pair, pair.a), fingerprintOf(pair, pair.b), pair.a.store === pair.b.store),
}));
const sure = rows.filter((r) => r.pair.confidence === "high");
const kind = (r: (typeof rows)[number]) => (r.decision === "missing" ? "missing" : r.decision.kind);

// Mismos topes que match-gold.test.ts (regex: 3 fusiones erróneas, recall 153/251); con identidad, 0 y ≥ 110.
const MAX_WRONG_MERGES = 0;
const MIN_SAME_LINKED = 110;

test("identidad anclada: 0 fusiones erróneas y recall sobre los pares seguros", () => {
  const wrong = sure.filter((r) => r.pair.label === "different" && kind(r) === "link");
  const same = sure.filter((r) => r.pair.label === "same");
  const linked = same.filter((r) => kind(r) === "link").length;
  console.log(`identidad: fusiones erróneas ${wrong.length}  recall ${linked}/${same.length}`);
  for (const r of wrong) console.log(`  ${r.pair.category}: ${r.pair.a.rawTitle} <> ${r.pair.b.rawTitle}`);
  expect(wrong.length).toBeLessThanOrEqual(MAX_WRONG_MERGES);
  expect(linked).toBeGreaterThanOrEqual(MIN_SAME_LINKED);
});
