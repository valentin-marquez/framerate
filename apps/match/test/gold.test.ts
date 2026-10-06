import { describe, expect, test } from "bun:test";
import { acceptGuard } from "@/guard";
import { type Side, verdictFor } from "@/judge";
import gold from "../../ingest/src/features/ingestion/domain/match-gold.json";
import recorded from "./gold-recorded.json";

// Probabilidades de Gemma grabadas con scripts/grabar-gold.ts: el test no gasta neurons. Si cambian el modelo, el
// prompt o el gold, regrabar.
const side = (s: { rawTitle: string; brand: string | null; mpn: string | null }): Side => ({
  title: s.rawTitle,
  brand: s.brand,
  mpn: s.mpn,
});

const rows = gold.map((g, i) => {
  const r = recorded[i];
  const a = side(g.a);
  const b = side(g.b);
  if (!r || r.a !== a.title || r.b !== b.title)
    throw new Error(`gold-recorded.json no coincide con el gold en ${i}: regrabar`);
  const accepted = verdictFor(r.pAB, r.pBA) === "accept" && acceptGuard(a, b).ok;
  return { g, accepted };
});
const high = rows.filter((r) => r.g.confidence === "high");

// Medido el 06-10: 223 aceptados por el modelo, 213 tras la guarda (y 1 fusión errónea del modelo que la guarda frena).
const ACCEPTED_FLOOR = 213;

describe("gold con las probabilidades grabadas", () => {
  test("ninguna fusión errónea: un par distinto de confianza alta nunca se acepta", () => {
    const wrong = high.filter((r) => r.g.label === "different" && r.accepted).map((r) => r.g.note);
    expect(wrong).toEqual([]);
  });

  test("los pares iguales de confianza alta aceptados no bajan del piso", () => {
    const accepted = high.filter((r) => r.g.label === "same" && r.accepted).length;
    expect(accepted).toBeGreaterThanOrEqual(ACCEPTED_FLOOR);
  });

  test("la guarda bloquea las variantes de memoria de confianza baja", () => {
    const memory = rows.filter((r) => r.g.confidence === "low" && r.g.note.includes("variante de memoria"));
    expect(memory.filter((r) => r.accepted)).toEqual([]);
  });
});
