import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";

/**
 * Contrato del normalizador (Haiku 5.5 con structured outputs, spec 2026-10-08-preprocesador-ia §2 y §3).
 *
 * Dos límites medidos de la API obligan la forma del esquema: máximo 16 campos nullable/union por esquema y una
 * gramática compilada acotada. Por eso todo es `string` ("" = desconocido, números como dígitos, booleanos como
 * "true"/"false"), la identidad es plana y por categoría, y la procedencia son listas de nombres de campo.
 */

/**
 * Sube sólo cuando cambia el contrato (un campo de identidad nuevo) o hay que volver a normalizar todo: invalida
 * `norm_hash` y re-encola todo. 2: `same_as` para todo el catálogo y el vocabulario canónico (#157, #158).
 */
export const NORMALIZER_VERSION = 2;
/** La ficha se recorta a esto antes del hash y del prompt. */
export const SOURCE_TEXT_MAX = 3000;

export const IDENTITY_FIELDS: Record<Category, readonly string[]> = {
  gpu: ["chipset", "vram_gb", "line", "oc", "variant", "color"],
  cpu: ["model", "packaging"],
  motherboard: ["chipset", "model", "line", "form_factor", "memory_type", "wifi", "variant", "color"],
  ram: [
    "type",
    "capacity_gb",
    "modules",
    "speed_mt_s",
    "form_factor",
    "line",
    "rgb",
    "color",
    "ecc",
    "registered",
    "cas_latency",
  ],
  psu: ["wattage", "efficiency", "line", "revision", "modular", "form_factor", "color"],
  ssd: ["capacity_gb", "interface", "form_factor", "pcie_gen", "line", "model"],
  hdd: ["capacity_gb", "rpm", "form_factor", "interface", "line", "model"],
  cpu_cooler: ["model", "type", "radiator_mm", "color", "rgb"],
  case: ["model", "form_factor", "color", "variant"],
  case_fan: ["model", "size_mm", "quantity", "color", "rgb"],
  keyboard: ["model", "layout", "wireless", "color"],
  mouse: ["model", "wireless", "color"],
};

export const SPEC_FIELDS: Record<Category, readonly string[]> = {
  gpu: [
    "memory_type",
    "memory_bus_bit",
    "core_boost_clock_mhz",
    "tdp_w",
    "length_mm",
    "slots",
    "hdmi",
    "displayport",
    "power_connectors",
  ],
  cpu: [
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
    "includes_cooler",
    "memory_types",
  ],
  motherboard: [
    "socket",
    "memory_slots",
    "memory_max_gb",
    "memory_max_speed_mt_s",
    "m2_slots",
    "pcie_x16_slots",
    "sata_ports",
    "wifi_standard",
    "ethernet",
    // Conectores (#188): casi nunca en la tienda, los trae la referencia por placa.
    "cpu_fan_headers",
    "chassis_fan_headers",
    "argb_5v_headers",
    "rgb_12v_headers",
    "usb_c_front_header",
    "bios_flashback",
  ],
  ram: ["timings", "voltage", "heat_spreader", "xmp_expo"],
  psu: ["atx_version", "fanless", "length_mm", "pcie_12vhpwr", "pcie_6_plus_2_pin", "sata_connectors"],
  ssd: ["read_speed_mb_s", "write_speed_mb_s", "nand_type", "dram_cache", "tbw", "controller"],
  hdd: ["cache_mb", "usage"],
  cpu_cooler: [
    "height_mm",
    "fan_size_mm",
    "fan_count",
    "tdp_rating_w",
    "sockets",
    "ram_clearance_mm",
    "noise_dba_max",
    "lighting",
  ],
  case: [
    "supported_motherboard_form_factors",
    "side_panel",
    "max_gpu_length_mm",
    "max_cpu_cooler_height_mm",
    "included_fans",
    "radiator_support_mm",
    "front_ports",
    "max_psu_length_mm",
  ],
  case_fan: [
    "rpm_max",
    "airflow_cfm_max",
    "pwm",
    // Desde #181 los completa la referencia por familia; Haiku los llena si la tienda los dice.
    "static_pressure_mmh2o",
    "noise_dba_max",
    "bearing",
    "lighting",
    "fan_controller",
  ],
  keyboard: ["form_factor", "switch_type", "wireless", "bluetooth", "backlight"],
  mouse: ["max_dpi", "polling_hz", "weight_g", "sensor", "wireless", "bluetooth", "buttons", "side_buttons"],
};

export const NUMERIC_IDENTITY_FIELDS = new Set([
  "vram_gb",
  "capacity_gb",
  "modules",
  "speed_mt_s",
  "cas_latency",
  "wattage",
  "pcie_gen",
  "rpm",
  "radiator_mm",
  "size_mm",
  "quantity",
]);
export const BOOLEAN_IDENTITY_FIELDS = new Set(["oc", "wifi", "rgb", "ecc", "registered", "wireless"]);

export const CONFIDENCES = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];
export const CONDITIONS = ["new", "used", "refurbished", "open_box"] as const;
export const OUTPUT_CATEGORIES = [...CATEGORIES, "other"] as const;

/** Esquema JSON para `output_config.format` de la categoría declarada. */
export function outputSchema(category: Category) {
  const str = { type: "string" };
  const strs = { type: "array", items: str };
  const obj = (keys: readonly string[]) => ({
    type: "object",
    properties: Object.fromEntries(keys.map((k) => [k, str])),
    required: [...keys],
    additionalProperties: false,
  });
  return {
    type: "object",
    properties: {
      category: { enum: [...OUTPUT_CATEGORIES] },
      category_reason: str,
      brand: str,
      name: str,
      mpn: str,
      condition: { enum: [...CONDITIONS] },
      confidence: { enum: [...CONFIDENCES] },
      identity: obj(IDENTITY_FIELDS[category]),
      identity_from_mpn: strs,
      identity_from_knowledge: strs,
      specs: obj(SPEC_FIELDS[category]),
      specs_from_knowledge: strs,
      same_as: str,
      duplicate_candidates: strs,
    },
    required: [
      "category",
      "category_reason",
      "brand",
      "name",
      "mpn",
      "condition",
      "confidence",
      "identity",
      "identity_from_mpn",
      "identity_from_knowledge",
      "specs",
      "specs_from_knowledge",
      "same_as",
      "duplicate_candidates",
    ],
    additionalProperties: false,
  };
}

export type IdentityValue = string | number | boolean;

function coerceIdentity(field: string, value: string): IdentityValue | null {
  const v = value.trim();
  if (v === "") return null;
  if (NUMERIC_IDENTITY_FIELDS.has(field)) {
    const n = Number(v.match(/^\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(n) ? n : null;
  }
  if (BOOLEAN_IDENTITY_FIELDS.has(field)) return v === "true" ? true : v === "false" ? false : null;
  return v;
}

function coerceSpec(value: string): IdentityValue | null {
  const v = value.trim();
  if (v === "") return null;
  if (/^\d+(?:\.\d+)?$/.test(v)) return Number(v);
  if (v === "true" || v === "false") return v === "true";
  return v;
}

/** Valida y tipa la salida de Haiku: "" → null, dígitos → número y "true"/"false" → boolean según el campo. */
export function NormalizationOutputSchema(category: Category) {
  const fields = (keys: readonly string[], coerce: (field: string, value: string) => IdentityValue | null) =>
    z.object(Object.fromEntries(keys.map((k) => [k, z.string().transform((v) => coerce(k, v))])));
  return z.object({
    category: z.enum(OUTPUT_CATEGORIES),
    category_reason: z.string(),
    brand: z.string().trim(),
    name: z.string().trim().min(5).max(120),
    mpn: z.string().trim(),
    condition: z.enum(CONDITIONS),
    confidence: z.enum(CONFIDENCES),
    identity: fields(IDENTITY_FIELDS[category], coerceIdentity),
    identity_from_mpn: z.array(z.string()),
    identity_from_knowledge: z.array(z.string()),
    specs: fields(SPEC_FIELDS[category], (_, v) => coerceSpec(v)),
    specs_from_knowledge: z.array(z.string()),
    // Las salidas grabadas antes de #157 no lo traen.
    same_as: z.string().trim().default(""),
    duplicate_candidates: z.array(z.string().trim()).default([]),
  });
}

export interface NormalizationOutput {
  category: Category | "other";
  category_reason: string;
  brand: string;
  name: string;
  mpn: string;
  condition: (typeof CONDITIONS)[number];
  confidence: Confidence;
  identity: Record<string, IdentityValue | null>;
  identity_from_mpn: string[];
  identity_from_knowledge: string[];
  specs: Record<string, IdentityValue | null>;
  specs_from_knowledge: string[];
  /** Id de un candidato del catálogo que es el mismo SKU, o "" (#157). */
  same_as: string;
  /** Otros candidatos que son ese mismo SKU: duplicados del catálogo que hay que fusionar. */
  duplicate_candidates: string[];
}

/** Lo que el anclaje necesita de la salida; es lo que se graba en el gold normalizado. */
export type IdentitySource = Pick<
  NormalizationOutput,
  "category" | "brand" | "name" | "mpn" | "confidence" | "identity" | "identity_from_mpn" | "identity_from_knowledge"
>;

/** Identidad anclada de una oferta (`listing_identity`): sólo lo que decide fusiones. */
export interface ListingIdentity {
  category: Category;
  /** Canónica (`canonicalBrand`); null si no se reconoce. */
  brand: string | null;
  name: string;
  /** Impreso en el texto y normalizado; null si Haiku lo inventó. */
  mpn: string | null;
  confidence: Confidence;
  /** Sólo campos anclados al texto o a un decodificador de MPN; lo desconocido no está. */
  identity: Record<string, IdentityValue>;
}
