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
 * // Forma recomendada (función pura):
 * import { analyzeBuild } from "@framerate/core/builder";
 * const analysis = analyzeBuild(componentsMap);
 *
 * // Forma legacy (clase, mantenida por compat):
 * import { CompatibilityEngine, ALL_RULES } from "@framerate/core/builder";
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
export {
  CPU_GEN_FACTORS,
  estimateGpuWattageFromName,
  GPU_ARCH_FACTORS,
  GPU_WATTAGE_FALLBACK,
  inferGpuArchitecture,
  resolveGpuArchitecture,
} from "./calibration";
export {
  analyzeBuild,
  CompatibilityEngine,
  calculateEstimatedWattage,
  estimatePerformance,
} from "./engine";
export {
  ALL_RULES,
  CompletenessRule,
  CoolerClearanceRule,
  GpuClearanceRule,
  MemorySlotRule,
  MemorySpeedRule,
  MemoryTypeRule,
  MotherboardFormFactorRule,
  PsuConnectorRule,
  SocketCompatibilityRule,
  StorageInterfaceRule,
  WattageRule,
} from "./rules";
