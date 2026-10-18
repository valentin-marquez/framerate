import { z } from "zod";

/** Resultado del verificador de compatibilidad de una cotización (#127, spec en #206). */

export const COMPAT_RULES = [
  "socket",
  "memory_type",
  "memory_type_cpu",
  "memory_form_factor",
  "memory_slots",
  "board_case",
  "gpu_length",
  "cooler_height",
  "radiator",
  "cooler_socket",
  "cooler_missing",
  "psu_wattage",
  "psu_tier",
] as const;
export type CompatRule = (typeof COMPAT_RULES)[number];

export const CompatCheckSchema = z.object({
  rule: z.enum(COMPAT_RULES),
  result: z.enum(["ok", "warning", "incompatible", "unknown"]),
  /** Ítems involucrados, para marcarlos en la lista. */
  itemIds: z.array(z.number().int()),
  message: z.string(),
});
export type CompatCheck = z.infer<typeof CompatCheckSchema>;

export const QuoteCompatibilitySchema = z.object({
  /** El peor resultado de `checks`; `unknown` también si no se pudo revisar nada. */
  status: z.enum(["valid", "warning", "incompatible", "unknown"]),
  checks: z.array(CompatCheckSchema),
  /** Procesador + GPU + 75 W para el resto; `null` sin procesador ni GPU, o sin el TDP de alguno. */
  estimatedWatts: z.number().int().nullable(),
});
export type QuoteCompatibility = z.infer<typeof QuoteCompatibilitySchema>;
