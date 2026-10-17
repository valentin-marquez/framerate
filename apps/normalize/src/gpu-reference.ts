import type { IdentityValue } from "@framerate/contracts";
import type { Db } from "@framerate/database";

/**
 * Referencia por chipset (#180), desde AMD y NVIDIA (`scripts/gpu-reference.ts`). Haiku elige el chipset de la lista y
 * la referencia completa las specs que dependen del chip, nunca las de la tarjeta de cada marca.
 */
export interface GpuReference {
  /** "rtx 5070 ti"; con la memoria cuando las variantes consumen distinto: "rtx 3050 8gb". */
  chipset: string;
  brand: "amd" | "nvidia" | "intel";
  name: string;
  number: string;
  /** "Blackwell", "Ada Lovelace", "RDNA 4". */
  architecture: string | null;
  launch: string | null;
  /** Núcleos CUDA o stream processors. */
  shader_cores: number | null;
  board_power_w: number | null;
  min_psu_w: number | null;
  power_connectors: string | null;
  memory_type: string | null;
  vram_gb: number[];
  memory_bus_bit: number | null;
  pcie_version: string | null;
  reference_length_mm: number | null;
  source_url: string;
}

/** "RTX 5070 Ti" y "rtx 5070 ti" son el mismo chipset. */
export const chipsetKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Sin la memoria de las variantes: lo que escribe Haiku en `identity.chipset`. */
export const baseChipset = (chipset: string) => chipset.replace(/\s\d+gb$/, "");

/** El número del chipset, para buscarlo por los números del título: "rtx 5070 ti" → "5070", "arc b580" → "580". */
export const chipsetNumber = (chipset: string) =>
  baseChipset(chipset)
    .match(/\d{3,4}/g)
    ?.at(-1) ?? "";

/** Las referencias cuyo número aparece en el título: sus chipsets son los `known_models` de Haiku. */
export async function gpuReferences(db: Db, title: string): Promise<GpuReference[]> {
  const numbers = [...new Set(title.match(/\d{3,4}/g) ?? [])];
  if (numbers.length === 0) return [];
  const rows = await db.query.selectFrom("gpu_reference").selectAll().where("number", "in", numbers).execute();
  return rows.map((r) => ({ ...r, brand: r.brand as GpuReference["brand"], vram_gb: JSON.parse(r.vram_gb) }));
}

/** La referencia de una tarjeta: la de su variante de memoria si existe, si no la del chipset. */
export function pickGpuReference(refs: readonly GpuReference[], chipset: string, vramGb: unknown) {
  const key = chipsetKey(chipset);
  return refs.find((r) => r.chipset === `${key} ${vramGb}gb`) ?? refs.find((r) => r.chipset === key);
}

/**
 * Completa las specs de una tarjeta con las del chipset. A diferencia del procesador no reemplaza lo que dice la
 * tienda: cada fabricante cambia consumo (versiones OC), largo y conectores, que por eso nunca salen de aquí. Sí
 * reemplaza lo que Haiku puso de memoria. `min_psu_w` y `architecture` no los escribe Haiku: salen sólo de aquí.
 */
export function fillFromGpuReference(
  specs: Record<string, IdentityValue>,
  source: Record<string, string>,
  ref: GpuReference | undefined,
) {
  if (!ref) return { specs, source };
  const out = { specs: { ...specs }, source: { ...source } };
  const fill = (key: string, value: IdentityValue | null) => {
    if (value === null || (out.specs[key] !== undefined && out.source[key] !== "knowledge")) return;
    out.specs[key] = value;
    out.source[key] = "reference";
  };
  fill("tdp_w", ref.board_power_w);
  fill("memory_type", ref.memory_type);
  fill("min_psu_w", ref.min_psu_w);
  fill("architecture", ref.architecture);
  return out;
}
