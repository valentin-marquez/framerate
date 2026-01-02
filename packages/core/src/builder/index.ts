/**
 * @module builder
 *
 * Sistema de cotizaciones inteligentes (Smart Build Engine).
 *
 * Exporta el motor de compatibilidad y todas las reglas de validación
 * disponibles para analizar builds de PC.
 *
 * @example
 * ```typescript
 * import { CompatibilityEngine, ALL_RULES } from "@framerate/core/builder";
 *
 * const engine = new CompatibilityEngine(ALL_RULES);
 * const analysis = engine.run(componentsMap);
 * ```
 */
export type {
  AnalyzeBuildRequest,
  AnalyzeBuildWithProductsRequest,
  BuildAnalysis,
  BuildComponentCategory,
  BuildComponentsMap,
  BuildProduct,
  BuildRule,
  CompatibilityStatus,
  ValidationIssue,
  ValidationSeverity,
} from "@framerate/db";
export { CompatibilityEngine } from "./engine";
export {
  ALL_RULES,
  CoolerClearanceRule,
  GpuClearanceRule,
  MemoryTypeRule,
  SocketCompatibilityRule,
  WattageRule,
} from "./rules";
