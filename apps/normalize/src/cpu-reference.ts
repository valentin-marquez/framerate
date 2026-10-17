import type { IdentityValue } from "@framerate/contracts";
import type { Db } from "@framerate/database";

/**
 * Referencia de procesadores (#179): una fila por modelo, sacada de las fichas oficiales de AMD e Intel
 * (`scripts/cpu-reference.ts`). Haiku elige el modelo de la lista y las specs salen de aquí, no de su memoria.
 */
export interface CpuReference {
  model: string;
  brand: "amd" | "intel";
  name: string;
  number: string;
  socket: string | null;
  cores_total: number | null;
  cores_performance: number | null;
  cores_efficiency: number | null;
  threads: number | null;
  base_ghz: number | null;
  boost_ghz: number | null;
  l3_mb: number | null;
  tdp_w: number | null;
  max_power_w: number | null;
  integrated_graphics: string | null;
  /** Cooler de la caja: "" si la caja no trae, null si la ficha no lo dice. */
  boxed_cooler: string | null;
  memory_types: string | null;
  memory_max_mt_s: number | null;
  launch: string | null;
  part_numbers: string[];
  source_url: string;
  unlocked: boolean | null;
  /** "5.0", "4.0". */
  pcie_version: string | null;
  memory_channels: number | null;
  max_memory_gb: number | null;
  /** AMD avisa en algunos modelos: "liquid" o "premium_air". */
  cooler_recommendation: string | null;
}

/** Clave de comparación de modelos: "Ryzen 7 7800X3D" y "ryzen 7 7800x3d" son el mismo. */
export const modelKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");

/**
 * El número de modelo, para buscar candidatos por título: "core ultra 7 265k" → "265", "ryzen 7 7800x3d" → "7800",
 * "core ultra 5 250k plus" → "250". Es el último grupo de 3 a 5 dígitos del nombre.
 */
export const modelNumber = (model: string) => model.match(/\d{3,5}/g)?.at(-1) ?? "";

/** Los modelos de referencia cuyo número aparece en el título: lo que se le muestra a Haiku como `known_models`. */
export async function cpuReferences(db: Db, title: string): Promise<CpuReference[]> {
  const numbers = [...new Set(title.match(/\d{3,5}/g) ?? [])];
  if (numbers.length === 0) return [];
  const rows = await db.query.selectFrom("cpu_reference").selectAll().where("number", "in", numbers).execute();
  return rows.map((r) => ({
    ...r,
    brand: r.brand as CpuReference["brand"],
    part_numbers: JSON.parse(r.part_numbers),
    unlocked: r.unlocked === null ? null : r.unlocked === 1,
  }));
}

const SPEC_KEYS = [
  "socket",
  "cores_total",
  "cores_performance",
  "cores_efficiency",
  "threads",
  "base_ghz",
  "boost_ghz",
  "l3_mb",
  "tdp_w",
  "integrated_graphics",
  "memory_types",
  // No está en SPEC_FIELDS (Haiku no lo adivina): sólo viene de la ficha, y la compatibilidad lo usa para la fuente.
  "max_power_w",
] as const;

/**
 * Las specs de la referencia en el formato de `listing_identity.specs`. `includes_cooler` depende de la oferta: una
 * tray nunca trae; una box trae lo que diga la ficha (AMD lo informa, Intel no, y entonces queda lo de Haiku).
 */
export function referenceSpecs(ref: CpuReference, packaging: string): Record<string, IdentityValue> {
  const out: Record<string, IdentityValue> = {};
  for (const key of SPEC_KEYS) {
    const value = ref[key];
    if (value != null) out[key] = value;
  }
  if (packaging === "tray") out.includes_cooler = false;
  else if (packaging === "box with cooler") out.includes_cooler = true;
  else if (packaging === "box" && ref.boxed_cooler !== null) out.includes_cooler = ref.boxed_cooler !== "";
  return out;
}

/** Aplica la referencia sobre las specs de Haiku: lo de la ficha oficial gana y queda marcado como `reference`. */
export function withReference(
  specs: Record<string, IdentityValue>,
  source: Record<string, string>,
  ref: CpuReference | undefined,
  packaging: string,
) {
  if (!ref) return { specs, source };
  const fromRef = referenceSpecs(ref, packaging);
  return {
    specs: { ...specs, ...fromRef },
    source: { ...source, ...Object.fromEntries(Object.keys(fromRef).map((k) => [k, "reference"])) },
  };
}
