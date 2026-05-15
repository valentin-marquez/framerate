/**
 * Centralised product category filter & MPN blocklist.
 *
 * Two concerns live here:
 *   1. `MPN_BLOCKLIST` — manual hard-blocks for known-bad MPNs that slipped
 *      into the catalog under the wrong category (e.g., PC Express files
 *      accessories like risers, NVLink bridges and TPM modules under the
 *      parent GPU / motherboard categories).
 *   2. Per-category title rules (`requiredTerms` + `excludeIfContains`) so a
 *      product wearing the wrong category jacket can be detected from its
 *      scraped title alone, well before it reaches the LLM pipeline.
 *
 * Title matching is case-insensitive (titles are upper-cased once before any
 * comparison). Empty / null titles are rejected outright.
 */

import type { Category } from "@/constants/categories";

/**
 * Hard MPN block list. Seeded with the 4 accessory MPNs that PC Express
 * misfiled under gpu / motherboard. Add new MPNs here as we discover them.
 */
export const MPN_BLOCKLIST: ReadonlySet<string> = new Set<string>([
  "0-761345-70001-6", // Cable Riser Antec PCI 4.0 White AT-RCVB-W200-PCIE4-RTX40
  "100-2W-0029-LR", // Bridge EVGA NVIDIA NVLink 3 Slot
  "TPM-M", // Asus TPM-M R2.0 Module
  "TPM-SPI", // Asus TPM-SPI Module
]);

/**
 * MPNs are compared via a normalized form (upper, alnum only) so spaces /
 * dashes / casing differences across stores never let a blocked MPN through.
 */
function normalizeMpn(mpn: string): string {
  return mpn.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const NORMALIZED_BLOCKLIST: ReadonlySet<string> = new Set(
  [...MPN_BLOCKLIST].map(normalizeMpn).filter((m) => m.length > 0),
);

export function isMpnBlocked(mpn: string | null | undefined): boolean {
  if (!mpn) return false;
  const key = normalizeMpn(mpn);
  if (!key) return false;
  return NORMALIZED_BLOCKLIST.has(key);
}

export interface CategoryFilterResult {
  allowed: boolean;
  reason?: string;
}

interface CategoryFilterRule {
  /** Any-of: at least one term must appear in the upper-cased title. */
  requiredTerms?: string[];
  /** Any-of: if any term appears in the upper-cased title, reject. */
  excludeIfContains?: string[];
  /** Hard-invalid product-state-ish terms scoped to this category. */
  invalidTerms?: string[];
  /** Custom predicate run last (already receives upper-cased title). */
  customCheck?: (titleUpper: string) => CategoryFilterResult;
}

/**
 * Per-category rules. The `gpu` / `motherboard` entries are the new
 * accessory-aware filters; everything else is ported faithfully from the
 * inline rules that used to live in `product.pipeline.ts`. Keep behaviour
 * stable unless an existing rule is obviously broken the same way.
 */
const CATEGORY_FILTERS: Partial<Record<Category, CategoryFilterRule>> = {
  gpu: {
    requiredTerms: ["TARJETA DE VIDEO", "TARJETA GRAFICA", "RTX", "RX ", "GTX", "ARC ", "RADEON", "GEFORCE", "GPU"],
    excludeIfContains: ["RISER", "NVLINK", "BRIDGE", "SLI", "VERTICAL", "SOPORTE", "CABLE"],
  },
  motherboard: {
    requiredTerms: ["PLACA MADRE", "MOTHERBOARD", "MAINBOARD"],
    excludeIfContains: ["TPM", "MODULE", "BRACKET", "HEADER", "POST CARD", "DEBUG", "PROCESADOR"],
  },
  cpu: {
    excludeIfContains: ["PLACA MADRE", "CONTROLADOR", "CONTROL DE LUCES", "ARGB CONTROLLER", "RGB CONTROLLER"],
  },
  psu: {
    excludeIfContains: ["MEMORIA RAM", "CONTROLADOR", "CONTROLADOR DE LUCES"],
  },
  case: {
    requiredTerms: ["GABINETE"],
    invalidTerms: ["CARCASA", "PLATAFORMA GIRATORIA"],
  },
  ssd: {
    invalidTerms: ["SOPORTE", "ADAPTADOR", "CARCASA", "MICROSD", "PENDRIVE"],
  },
  hdd: {
    invalidTerms: ["SOPORTE", "ADAPTADOR", "CARCASA", "MICROSD", "PENDRIVE"],
  },
  ram: {
    excludeIfContains: ["SOPORTE", "DISIPADOR SOLO"],
  },
  case_fan: {
    excludeIfContains: ["PASTA TERMICA", "PASTA TÉRMICA", "HUB"],
    customCheck: (titleUpper: string) => {
      const hasVentilador = titleUpper.includes("VENTILADOR") || titleUpper.includes("VENTILADORES");
      const isExcluded =
        titleUpper.includes("SOPORTE") ||
        titleUpper.includes("COOLER CPU") ||
        titleUpper.includes("DISIPADOR") ||
        titleUpper.includes("WATER COOLING") ||
        titleUpper.includes("REFRIGERACION LIQUIDA") ||
        titleUpper.includes("REFRIGERACIÓN LÍQUIDA") ||
        titleUpper.includes("AIO");
      if (!hasVentilador) {
        return { allowed: false, reason: "ventilador de gabinete debe contener 'VENTILADOR'" };
      }
      if (isExcluded) {
        return { allowed: false, reason: "producto excluido (cooler CPU, soporte, AIO, etc.)" };
      }
      return { allowed: true };
    },
  },
  cpu_cooler: {
    excludeIfContains: ["ADAPTADOR", "PASTA TERMICA", "PASTA TÉRMICA", "HUB"],
    customCheck: (titleUpper: string) => {
      const isLiquidCooling =
        titleUpper.includes("REFRIGERACION LIQUIDA") ||
        titleUpper.includes("REFRIGERACIÓN LÍQUIDA") ||
        titleUpper.includes("REGRIGERACION LIQUIDA") ||
        titleUpper.includes("WATERCOOLING") ||
        titleUpper.includes("WATER COOLING") ||
        titleUpper.includes("AIO");

      const isAirCooler =
        titleUpper.includes("VENTILADOR PARA CPU") ||
        titleUpper.includes("VENTILADOR CPU") ||
        titleUpper.includes("COOLER CPU") ||
        titleUpper.includes("CPU COOLER") ||
        titleUpper.includes("DISIPADOR CPU");

      if (!isLiquidCooling && !isAirCooler) {
        return { allowed: false, reason: "producto no es un cooler de CPU" };
      }
      return { allowed: true };
    },
  },
};

/**
 * Decide whether the given title belongs to `category` based on the
 * configured per-category rules. Empty / null titles are rejected.
 */
export function isAllowedForCategory(title: string | null | undefined, category: Category): CategoryFilterResult {
  const cleaned = (title ?? "").trim();
  if (!cleaned) {
    return { allowed: false, reason: "título vacío" };
  }

  const upper = cleaned.toUpperCase();
  const rule = CATEGORY_FILTERS[category];
  if (!rule) return { allowed: true };

  if (rule.invalidTerms) {
    for (const term of rule.invalidTerms) {
      if (upper.includes(term)) {
        return { allowed: false, reason: `contiene término inválido: ${term}` };
      }
    }
  }

  if (rule.excludeIfContains) {
    for (const term of rule.excludeIfContains) {
      if (upper.includes(term)) {
        return { allowed: false, reason: `contiene término excluido: ${term}` };
      }
    }
  }

  if (rule.requiredTerms && rule.requiredTerms.length > 0) {
    const hasRequired = rule.requiredTerms.some((term) => upper.includes(term));
    if (!hasRequired) {
      return { allowed: false, reason: "falta término requerido" };
    }
  }

  if (rule.customCheck) {
    return rule.customCheck(upper);
  }

  return { allowed: true };
}
