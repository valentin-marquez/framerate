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
import { cleanHtmlEntities, normalizeGenericTitle, stripVendorNoise } from "./utils";

/**
 * Normaliza un título de producto basado en su categoría
 * @param title - Título original del producto
 * @param category - Slug de la categoría del producto
 * @param mpn - MPN del producto (opcional, usado para detección de línea desde código)
 * @param manufacturer - Fabricante desde especificaciones/meta tags (opcional, usado como fallback)
 */
export function normalizeTitle(title: string, category: CategorySlug, mpn?: string, manufacturer?: string): string {
  // Saneo común para TODAS las tiendas: el ruido entre paréntesis y los
  // paréntesis sueltos no son exclusivos de MyShop (también aparecen vía
  // pc-express, notebooksya, etc.). Se limpia acá, antes de cualquier
  // normalizador específico, en una sola fuente de verdad.
  const t = stripVendorNoise(title);
  switch (category) {
    case "hdd":
      return normalizeHddTitle(t, mpn, manufacturer);
    case "ssd":
      return normalizeSsdTitle(t, mpn, manufacturer);
    case "gpu":
      return normalizeGpuTitle(t, mpn, manufacturer);
    case "motherboard":
      return normalizeMotherboardTitle(t, mpn, manufacturer);
    case "psu":
      return normalizePsuTitle(t, mpn, manufacturer);
    case "ram":
      return normalizeRamTitle(t, mpn, manufacturer);
    case "case_fan":
      return normalizeCaseFanTitle(t, mpn, manufacturer);
    case "cpu_cooler":
      return normalizeCpuCoolerTitle(t, mpn, manufacturer);
    case "cpu":
      return normalizeCpuTitle(t, mpn, manufacturer);
    case "case":
      return normalizeCaseTitle(t, mpn, manufacturer);
    default:
      return normalizeGenericTitle(t);
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
