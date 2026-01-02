/**
 * @module builder.types
 *
 * Tipos compartidos para el sistema de cotizaciones inteligentes (Smart Build Engine).
 * Estos tipos son utilizados tanto por la API como por el frontend para validar
 * compatibilidad de componentes en tiempo real.
 */

import type { Tables } from "./types";

/**
 * Severidad de un problema de compatibilidad
 * - info: Información adicional, no bloquea el build
 * - warning: Advertencia que debe ser revisada, pero no es crítica
 * - error: Error crítico que hace el build incompatible
 */
export type ValidationSeverity = "info" | "warning" | "error";

/**
 * Estado general de compatibilidad de un build
 * - valid: Todos los componentes son compatibles
 * - warning: Build funcional pero con advertencias
 * - incompatible: Hay errores críticos que impiden su funcionamiento
 */
export type CompatibilityStatus = "valid" | "warning" | "incompatible";

/**
 * Códigos de error estandarizados para problemas de compatibilidad
 */
export enum ValidationCode {
  // Socket compatibility
  SOCKET_MISMATCH = "SOCKET_MISMATCH",
  UNKNOWN_SOCKET = "UNKNOWN_SOCKET",

  // Power compatibility
  INSUFFICIENT_WATTAGE = "INSUFFICIENT_WATTAGE",
  LOW_WATTAGE_HEADROOM = "LOW_WATTAGE_HEADROOM",
  UNKNOWN_POWER = "UNKNOWN_POWER",

  // Memory compatibility
  MEMORY_TYPE_MISMATCH = "MEMORY_TYPE_MISMATCH",
  MEMORY_SPEED_INCOMPATIBLE = "MEMORY_SPEED_INCOMPATIBLE",
  UNKNOWN_MEMORY_TYPE = "UNKNOWN_MEMORY_TYPE",

  // Physical compatibility
  GPU_TOO_LONG = "GPU_TOO_LONG",
  COOLER_TOO_TALL = "COOLER_TOO_TALL",
  CASE_FORM_FACTOR_MISMATCH = "CASE_FORM_FACTOR_MISMATCH",

  // General warnings
  MISSING_COMPONENT = "MISSING_COMPONENT",
  SPEC_DATA_INCOMPLETE = "SPEC_DATA_INCOMPLETE",
}

/**
 * Representa un problema de compatibilidad detectado
 */
export interface ValidationIssue {
  /** Código único del problema */
  code: ValidationCode | string;

  /** Severidad del problema */
  severity: ValidationSeverity;

  /** Mensaje descriptivo para el usuario */
  message: string;

  /** Componente principal afectado (opcional) */
  componentA?: string;

  /** Componente secundario relacionado (opcional) */
  componentB?: string;

  /** Información adicional o sugerencias */
  details?: string;
}

/**
 * Resultado del análisis de compatibilidad de un build
 */
export interface BuildAnalysis {
  /** Estado general de compatibilidad */
  status: CompatibilityStatus;

  /** Consumo estimado de energía en Watts */
  estimatedWattage: number;

  /** Lista de problemas encontrados */
  issues: ValidationIssue[];

  /** Timestamp del análisis */
  analyzedAt: string;
}

/**
 * Categorías de componentes válidas para un build
 */
export type BuildComponentCategory =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "psu"
  | "case"
  | "cpu-cooler"
  | "ssd"
  | "hdd"
  | "case-fan";

/**
 * Producto con sus specs completas (usado en el análisis)
 */
export type BuildProduct = Tables<"products"> & {
  category: { slug: string; name: string };
  brand: { name: string };
};

/**
 * Mapa de componentes por categoría
 * Clave: categoría del componente
 * Valor: producto completo con specs
 */
export type BuildComponentsMap = Partial<Record<BuildComponentCategory, BuildProduct>>;

/**
 * Interfaz que debe implementar cada regla de validación
 */
export interface BuildRule {
  /** Nombre identificador de la regla */
  name: string;

  /**
   * Ejecuta la validación sobre el mapa de componentes
   * @param parts Mapa de componentes a validar
   * @returns Array de problemas encontrados (vacío si todo está bien)
   */
  validate(parts: BuildComponentsMap): ValidationIssue[];
}

/**
 * Request para el endpoint de análisis
 */
export interface AnalyzeBuildRequest {
  /** Lista de IDs de productos a analizar */
  productIds: string[];
}

/**
 * Request alternativo con productos completos (para evitar consultas adicionales)
 */
export interface AnalyzeBuildWithProductsRequest {
  /** Lista de productos completos con sus specs */
  products: BuildProduct[];
}
