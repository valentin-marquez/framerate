/**
 * @module builder.types
 *
 * Tipos compartidos para el sistema de cotizaciones inteligentes (Smart Build Engine).
 * Estos tipos son utilizados tanto por la API como por el frontend para validar
 * compatibilidad de componentes en tiempo real.
 */

import type { ProductSpecs } from "./specs.types";
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

  // Build completeness / extras
  MISSING_VIDEO_OUTPUT = "MISSING_VIDEO_OUTPUT",
  USING_INTEGRATED_GRAPHICS = "USING_INTEGRATED_GRAPHICS",
  MISSING_CPU_COOLER = "MISSING_CPU_COOLER",
  USING_STOCK_COOLER = "USING_STOCK_COOLER",
  UNKNOWN_COOLING = "UNKNOWN_COOLING",
  MISSING_CASE = "MISSING_CASE",
  NO_CASE_FANS = "NO_CASE_FANS",
  USING_INCLUDED_FANS = "USING_INCLUDED_FANS",

  // Insufficient data signal (info-level)
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",

  // PSU connector compatibility
  MISSING_12VHPWR = "MISSING_12VHPWR",
  INSUFFICIENT_PCIE_CONNECTORS = "INSUFFICIENT_PCIE_CONNECTORS",

  // Motherboard form factor / case
  MOTHERBOARD_FORM_FACTOR_MISMATCH = "MOTHERBOARD_FORM_FACTOR_MISMATCH",

  // Memory slot/speed
  MEMORY_SLOTS_EXCEEDED = "MEMORY_SLOTS_EXCEEDED",
  MEMORY_SPEED_REQUIRES_OC = "MEMORY_SPEED_REQUIRES_OC",

  // Storage interface
  STORAGE_INTERFACE_EXCEEDED = "STORAGE_INTERFACE_EXCEEDED",

  // Internal
  INTERNAL_VALIDATION_ERROR = "INTERNAL_VALIDATION_ERROR",
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
 * Estimación de rendimiento del build (Gaming Score)
 */
export interface PerformanceEstimation {
  cpuScore: number;
  gpuScore: number;
  totalScore: number;
  tier: string;
}

/**
 * Resultado del análisis de compatibilidad de un build
 */
export interface BuildAnalysis {
  /** Estado general de compatibilidad */
  status: CompatibilityStatus;

  /** Consumo estimado de energía en Watts */
  estimatedWattage: number;

  /** Estimación de rendimiento (heurística) */
  performance?: PerformanceEstimation;

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
 * Producto con sus specs completas (usado en el análisis).
 *
 * Sólo incluye campos efectivamente consumidos por `CompatibilityEngine`
 * (specs, name) y por el mapeo a categorías (category, brand). Mantenemos
 * `id/slug/mpn/image_url` opcionales para reporting; otros campos de la
 * tabla `products` (brand_id, created_at, etc.) no son necesarios y obligaban
 * a callers a hacer `as unknown as BuildProduct` cuando los SELECT no los
 * traían.
 */
export type BuildProduct = Pick<Tables<"products">, "name"> &
  Partial<Pick<Tables<"products">, "id" | "slug" | "mpn" | "image_url">> & {
    specs: ProductSpecs;
    category: { slug: string; name: string };
    brand: { name: string };
    quantity?: number;
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
