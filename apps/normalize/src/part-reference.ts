import type { IdentityValue } from "@framerate/contracts";
import type { Db } from "@framerate/database";

/** Las categorías con referencia por modelo en `part_reference` (#182). */
export const PART_CATEGORIES = new Set(["cpu_cooler", "case"]);

/** Referencia de un modelo con sus specs ya en el formato de `listing_identity.specs`. */
export interface PartReference {
  category: string;
  brand: string;
  model: string;
  specs: Record<string, IdentityValue>;
  aliases: string[];
  source_url: string | null;
}

/** "be quiet!" → "bequiet"; "Peerless Assassin 120 SE" → "peerlessassassin120se". */
export const partKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function partReferences(db: Db, category: string, brand: string | null): Promise<PartReference[]> {
  if (!brand || !PART_CATEGORIES.has(category)) return [];
  const rows = await db.query
    .selectFrom("part_reference")
    .selectAll()
    .where("category", "=", category)
    .where("brand_key", "=", partKey(brand))
    .execute();
  return rows.map((r) => ({ ...r, specs: JSON.parse(r.specs), aliases: JSON.parse(r.aliases) }));
}

/**
 * El modelo por su nombre oficial o por cómo lo escribe el catálogo. Si dos filas calzan (un AIO de 240 y uno de 360
 * con el mismo nombre), desempata el radiador de la oferta.
 */
export function pickPartReference(refs: readonly PartReference[], model: string, radiatorMm?: unknown) {
  const key = partKey(model);
  if (!key) return undefined;
  const hits = refs.filter((r) => partKey(r.model) === key || r.aliases.some((a) => partKey(a) === key));
  if (hits.length <= 1) return hits[0];
  return hits.find((r) => Number(r.specs.radiator_mm) === Number(radiatorMm));
}

/** Completa lo que falta o lo que Haiku puso de memoria; lo que dice la tienda gana. */
export function fillFromPartReference(
  specs: Record<string, IdentityValue>,
  source: Record<string, string>,
  ref: PartReference | undefined,
) {
  if (!ref) return { specs, source };
  const out = { specs: { ...specs }, source: { ...source } };
  for (const [key, value] of Object.entries(ref.specs)) {
    if (value === null || value === "" || (out.specs[key] !== undefined && out.source[key] !== "knowledge")) continue;
    out.specs[key] = value;
    out.source[key] = "reference";
  }
  return out;
}
