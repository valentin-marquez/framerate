import type { QuoteSlot } from "@framerate/contracts";

/** Sigla del recuadro de un slot sin producto (los nombres y qué categoría va en cada slot salen de contracts). */
export const SLOT_SHORT_LABELS: Record<QuoteSlot, string> = {
  cpu: "CPU",
  motherboard: "MB",
  ram: "RAM",
  gpu: "GPU",
  psu: "PSU",
  case: "CASE",
  cpu_cooler: "COOLER",
  storage: "SSD/HDD",
  case_fan: "FAN",
};
