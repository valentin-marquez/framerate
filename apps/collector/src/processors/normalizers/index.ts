/**
 * Normalizador de Títulos - Punto de Entrada Principal
 *
 * Enruta la normalización de títulos a los normalizadores específicos de cada categoría.
 * Este módulo actúa como dispatcher para cada tipo de producto.
 *
 * ADVERTENCIA: Todo este sistema de normalización es horrible y necesita refactorización urgente.
 * TODO: Mejorar esta atrocidad completa cuando tengamos tiempo (nunca).
 */

import { normalizeCaseTitle } from "./case";
import { normalizeCaseFanTitle } from "./case-fan";
import { normalizeCpuTitle } from "./cpu";
import { normalizeCpuCoolerTitle } from "./cpu-cooler";
import { normalizeGpuTitle } from "./gpu";
import { normalizeHddTitle } from "./hdd";
import { normalizeMotherboardTitle } from "./motherboard";
import { normalizePsuTitle } from "./psu";
import { normalizeRamTitle } from "./ram";
import { normalizeSsdTitle } from "./ssd";
import type { CategorySlug } from "./types";
import { cleanHtmlEntities, normalizeGenericTitle } from "./utils";

/**
 * Normaliza un título de producto basado en su categoría
 * @param title - Título original del producto
 * @param category - Slug de la categoría del producto
 * @param mpn - MPN del producto (opcional, usado para detección de línea desde código)
 * @param manufacturer - Fabricante desde especificaciones/meta tags (opcional, usado como fallback)
 */
export function normalizeTitle(title: string, category: CategorySlug, mpn?: string, manufacturer?: string): string {
  switch (category) {
    case "hdd":
      return normalizeHddTitle(title, mpn, manufacturer);
    case "ssd":
      return normalizeSsdTitle(title, mpn, manufacturer);
    case "gpu":
      return normalizeGpuTitle(title, mpn, manufacturer);
    case "motherboard":
      return normalizeMotherboardTitle(title, mpn, manufacturer);
    case "psu":
      return normalizePsuTitle(title, mpn, manufacturer);
    case "ram":
      return normalizeRamTitle(title, mpn, manufacturer);
    case "case_fan":
      return normalizeCaseFanTitle(title, mpn, manufacturer);
    case "cpu_cooler":
      return normalizeCpuCoolerTitle(title, mpn, manufacturer);
    case "cpu":
      return normalizeCpuTitle(title, mpn, manufacturer);
    case "case":
      return normalizeCaseTitle(title, mpn, manufacturer);
    default:
      return normalizeGenericTitle(title);
  }
}

/**
 * Utilidades de normalización exportadas
 */
export const TitleNormalizer = {
  normalize: normalizeTitle,
  normalizeCase: normalizeCaseTitle,
  normalizeCpu: normalizeCpuTitle,
  normalizeCpuCooler: normalizeCpuCoolerTitle,
  normalizeHdd: normalizeHddTitle,
  normalizeSsd: normalizeSsdTitle,
  normalizeGpu: normalizeGpuTitle,
  normalizeMotherboard: normalizeMotherboardTitle,
  normalizePsu: normalizePsuTitle,
  normalizeRam: normalizeRamTitle,
  normalizeCaseFan: normalizeCaseFanTitle,
  cleanHtmlEntities,
};

export { normalizeCaseTitle } from "./case";
export { normalizeCaseFanTitle } from "./case-fan";
// Re-exportar normalizadores individuales para acceso directo
export { normalizeCpuTitle } from "./cpu";
export { normalizeCpuCoolerTitle } from "./cpu-cooler";
export { normalizeGpuTitle } from "./gpu";
export { normalizeHddTitle } from "./hdd";
export { normalizeMotherboardTitle } from "./motherboard";
export { normalizePsuTitle } from "./psu";
export { normalizeRamTitle } from "./ram";
export { normalizeSsdTitle } from "./ssd";
// Re-exportar tipos
export type { BrandModel, CategorySlug, NormalizerContext } from "./types";
export { cleanHtmlEntities, normalizeGenericTitle } from "./utils";
