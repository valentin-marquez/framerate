import type { IdentityValue } from "@framerate/contracts";
import type { Db } from "@framerate/database";

/** Referencia de ventiladores por familia y tamaño (#181), desde las fichas de cada fabricante. */
export interface FanReference {
  brand: string;
  family: string;
  size_mm: number | null;
  rpm_min: number | null;
  rpm_max: number | null;
  airflow_cfm: number | null;
  static_pressure_mmh2o: number | null;
  noise_dba: number | null;
  bearing: string | null;
  fan_connector: string | null;
  lighting: string | null;
  controller: string | null;
  requires_controller: boolean | null;
  daisy_chain: boolean | null;
  warranty_years: number | null;
  aliases: string[];
  source_url: string | null;
}

/** "be quiet!" → "bequiet"; "UNI FAN SL V2" → "unifanslv2". */
export const fanKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function fanReferences(db: Db, brand: string | null): Promise<FanReference[]> {
  if (!brand) return [];
  const rows = await db.query.selectFrom("fan_reference").selectAll().where("brand_key", "=", fanKey(brand)).execute();
  const bool = (v: number | null) => (v === null ? null : v === 1);
  return rows.map((r) => ({
    ...r,
    requires_controller: bool(r.requires_controller),
    daisy_chain: bool(r.daisy_chain),
    aliases: JSON.parse(r.aliases),
  }));
}

/**
 * La fila de un ventilador: la familia por su nombre o por cómo la escribe el catálogo, y entre sus tamaños el de la
 * oferta (si la oferta no lo dice, el de 120 mm, que es el que más se vende).
 */
export function pickFanReference(refs: readonly FanReference[], model: string, sizeMm: unknown) {
  const key = fanKey(model);
  if (!key) return undefined;
  const family = refs.filter((r) => fanKey(r.family) === key || r.aliases.some((a) => fanKey(a) === key));
  const size = Number(sizeMm) || 120;
  return family.find((r) => r.size_mm === size) ?? (family.length === 1 ? family[0] : undefined);
}

/**
 * Completa las specs de un ventilador con su ficha oficial. Sólo llena lo que falta o lo que Haiku puso de memoria:
 * si la tienda escribe otra cosa (un pack con otra velocidad, una revisión), gana la tienda.
 */
export function fillFromFanReference(
  specs: Record<string, IdentityValue>,
  source: Record<string, string>,
  ref: FanReference | undefined,
) {
  if (!ref) return { specs, source };
  const out = { specs: { ...specs }, source: { ...source } };
  const fill = (key: string, value: IdentityValue | null) => {
    if (value === null || (out.specs[key] !== undefined && out.source[key] !== "knowledge")) return;
    out.specs[key] = value;
    out.source[key] = "reference";
  };
  fill("rpm_max", ref.rpm_max);
  fill("airflow_cfm_max", ref.airflow_cfm);
  fill("static_pressure_mmh2o", ref.static_pressure_mmh2o);
  fill("noise_dba_max", ref.noise_dba);
  fill("bearing", ref.bearing);
  fill("lighting", ref.lighting);
  fill("pwm", ref.fan_connector === null ? null : ref.fan_connector === "4pin_pwm");
  fill("fan_controller", ref.requires_controller ? ref.controller : null);
  return out;
}
