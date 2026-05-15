/**
 * @module builder/engine
 *
 * Motor de compatibilidad para validar builds de PC.
 * Implementa el patrón Chain of Responsibility para ejecutar
 * múltiples reglas de validación sobre un conjunto de componentes.
 */

import type {
  BuildAnalysis,
  BuildComponentsMap,
  BuildRule,
  CaseSpecs,
  CompatibilityStatus,
  CpuCoolerSpecs,
  CpuSpecs,
  GpuSpecs,
  PerformanceEstimation,
  ValidationIssue,
} from "@framerate/db";
import {
  CPU_GEN_FACTORS,
  estimateGpuWattageFromName,
  GPU_ARCH_FACTORS,
  getGpuTransientFactor,
  PERIPHERAL_WATTAGE,
  POWER_FACTORS,
  resolveGpuArchitecture,
} from "./calibration";

/**
 * Determina si un cooler es del tipo AIO (refrigeración líquida).
 *
 * Estrategia:
 * 1. Lee `specs.type` (enum del schema, valor "AIO" o "Custom Loop").
 * 2. Si no, revisa `specs.water_cooled` o presencia de `radiator_size_mm > 0`.
 * 3. Como último recurso, busca substrings en el nombre.
 */
function isAioCooler(name: string, specs: CpuCoolerSpecs | undefined): boolean {
  if (specs) {
    if (specs.type === "AIO" || specs.type === "Custom Loop") return true;
    if (specs.type === "Air" || specs.type === "Fanless") return false;
    if (specs.water_cooled === true) return true;
    if (typeof specs.radiator_size_mm === "number" && specs.radiator_size_mm > 0) {
      return true;
    }
  }
  const n = name.toLowerCase();
  return n.includes("liquid") || n.includes("aio") || n.includes("water");
}

/**
 * Función pura que ejecuta el análisis de un build.
 *
 * Es la entrada recomendada del motor: no requiere instancia, no muta estado,
 * y permite testear/componer fácilmente.
 *
 * @param components Mapa de componentes a analizar
 * @param rules Reglas a ejecutar. Si se omite, se usan ALL_RULES.
 */
export function analyzeBuild(components: BuildComponentsMap, rules?: BuildRule[]): BuildAnalysis {
  // Lazy import para evitar ciclo: rules.ts importa de engine.ts.
  // Si no se pasan reglas, las cargamos desde el módulo de reglas.
  const activeRules = rules ?? requireAllRules();

  const issues: ValidationIssue[] = [];

  for (const rule of activeRules) {
    try {
      const ruleIssues = rule.validate(components);
      issues.push(...ruleIssues);
    } catch (error) {
      console.error(`Rule ${rule.name} failed:`, error);
      issues.push({
        code: "INTERNAL_VALIDATION_ERROR",
        severity: "warning",
        message: `No se pudo validar: ${rule.name}`,
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  const estimatedWattage = calculateEstimatedWattage(components);
  const status = determineStatus(issues);
  const performance = estimatePerformance(components);

  return {
    status,
    estimatedWattage,
    performance,
    issues,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Determina el estado general de compatibilidad a partir de los issues.
 * Solo `error` baja a "incompatible"; `warning` a "warning"; `info` no afecta.
 */
function determineStatus(issues: ValidationIssue[]): CompatibilityStatus {
  if (issues.length === 0) return "valid";

  const hasErrors = issues.some((issue) => issue.severity === "error");
  if (hasErrors) return "incompatible";

  const hasWarnings = issues.some((issue) => issue.severity === "warning");
  if (hasWarnings) return "warning";

  return "valid";
}

/**
 * Estima el rendimiento del build (Gaming Score).
 */
export function estimatePerformance(components: BuildComponentsMap): PerformanceEstimation {
  const cpu = components.cpu;
  const gpu = components.gpu;

  // 1. CPU Score
  let cpuScore = 0;
  if (cpu?.specs) {
    const specs = cpu.specs as CpuSpecs;
    const microArch = specs.microarchitecture || "Zen 2";
    const factor = CPU_GEN_FACTORS[microArch] ?? 1.0;

    const cores = specs.cores?.total ?? 4;
    const threads = specs.cores?.threads ?? cores;
    const boost = specs.clocks?.boost_ghz ?? 3.5;

    cpuScore = Math.round((cores * 0.7 + threads * 0.3) * boost * factor * 110);
  }

  // 2. GPU Score
  let gpuScore = 0;
  if (gpu?.specs) {
    const specs = gpu.specs as GpuSpecs;
    const arch = resolveGpuArchitecture(specs) || "Pascal";
    const factor = GPU_ARCH_FACTORS[arch] ?? 1.2;

    const vram = specs.memory_gb ?? 4;
    const bus = specs.memory_bus_bit ?? 128;
    const clockMhz = specs.core_boost_clock_mhz ?? 1500;
    const clock = clockMhz / 1000;

    gpuScore = Math.round(vram * (bus / 64) * clock * factor * 65);
  }

  // 3. Score combinado (85% GPU / 15% CPU para gaming, harmónico)
  const safeCpuScore = cpuScore || 1000;
  const safeGpuScore = gpuScore || 1000;
  const totalScore = Math.round(1 / (0.85 / safeGpuScore + 0.15 / safeCpuScore));

  let tier = "Entry";
  if (totalScore > 25000) tier = "4K / Enthusiast";
  else if (totalScore > 20000) tier = "Elite";
  else if (totalScore > 10000) tier = "High / 1440p";
  else if (totalScore > 5000) tier = "Mid / 1080p";
  else tier = "Entry / Ofimática";

  return { cpuScore, gpuScore, totalScore, tier };
}

// Registro de reglas por defecto. `rules.ts` lo poblará al importarse
// (evitamos un import circular estático).
let defaultRulesRegistry: BuildRule[] | null = null;

/**
 * Registra el set de reglas por defecto que `analyzeBuild` usa cuando se
 * llama sin pasar reglas explícitas.
 *
 * Llamado por `rules.ts` al cargar el módulo. No es para uso público.
 */
export function _registerDefaultRules(rules: BuildRule[]): void {
  defaultRulesRegistry = rules;
}

function requireAllRules(): BuildRule[] {
  if (defaultRulesRegistry) return defaultRulesRegistry;
  // Fallback: si nadie registró reglas, devolvemos vacío en vez de crashear.
  // Esto solo pasaría si `analyzeBuild` se importa antes que `rules.ts`,
  // lo cual no ocurre en el path normal porque `index.ts` importa rules.
  return [];
}

/**
 * Motor principal de análisis de compatibilidad (clase, mantenida por compat).
 *
 * Internamente delega en `analyzeBuild`. Nuevos consumidores deberían usar
 * la función pura.
 */
export class CompatibilityEngine {
  private rules: BuildRule[];

  constructor(rules: BuildRule[]) {
    this.rules = rules;
  }

  run(components: BuildComponentsMap): BuildAnalysis {
    return analyzeBuild(components, this.rules);
  }

  /**
   * @deprecated Usar `estimatePerformance` exportado del módulo.
   */
  estimatePerformance(components: BuildComponentsMap): PerformanceEstimation {
    return estimatePerformance(components);
  }

  addRule(rule: BuildRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleName: string): void {
    this.rules = this.rules.filter((rule) => rule.name !== ruleName);
  }

  getActiveRules(): string[] {
    return this.rules.map((rule) => rule.name);
  }
}

/**
 * Calcula el consumo total estimado de energía del build, en Watts.
 *
 * No es la suma simple de TDPs nominales: aplica factores de boost para CPU
 * (PPT/PL2, ~1.3×) y de transient para GPU (1.2–1.4× según arquitectura).
 * El valor resultante aproxima el consumo real bajo carga combinado, que es
 * el que la PSU debe soportar de pico para evitar OCP trips.
 *
 * Fuentes de los factores: `calibration.ts > POWER_FACTORS / PERIPHERAL_WATTAGE`.
 */
export function calculateEstimatedWattage(components: BuildComponentsMap): number {
  let total = 0;

  // CPU: TDP × boost factor (aproxima PPT/PL2 bajo carga sostenida)
  const cpu = components.cpu;
  if (cpu?.specs && "tdp_w" in cpu.specs) {
    const tdp = (cpu.specs as CpuSpecs).tdp_w || 0;
    total += tdp * POWER_FACTORS.CPU_BOOST;
  }

  // GPU: TDP × transient factor (modern/legacy según arquitectura)
  const gpu = components.gpu;
  if (gpu) {
    const gpuSpecs = gpu.specs as GpuSpecs;
    const baseTdp = gpuSpecs.tdp_w || estimateGpuWattageFromName(gpu.name);
    const arch = resolveGpuArchitecture(gpuSpecs);
    total += baseTdp * getGpuTransientFactor(arch);
  }

  // RAM
  if (components.ram) {
    total += PERIPHERAL_WATTAGE.RAM_PER_MODULE * (components.ram.quantity || 1);
  }

  // Storage
  if (components.ssd) {
    total += PERIPHERAL_WATTAGE.SSD_PER_UNIT * (components.ssd.quantity || 1);
  }
  if (components.hdd) {
    total += PERIPHERAL_WATTAGE.HDD_PER_UNIT * (components.hdd.quantity || 1);
  }

  // CPU Cooler (AIO consume bomba + fans + RGB)
  const cooler = components["cpu-cooler"];
  if (cooler) {
    const aio = isAioCooler(cooler.name, cooler.specs as CpuCoolerSpecs | undefined);
    const watts = aio ? PERIPHERAL_WATTAGE.COOLER_AIO : PERIPHERAL_WATTAGE.COOLER_AIR;
    total += watts * (cooler.quantity || 1);
  }

  // Case fans extra
  if (components["case-fan"]) {
    total += PERIPHERAL_WATTAGE.CASE_FAN * (components["case-fan"].quantity || 1);
  }

  // Case included fans
  const pcCase = components.case;
  if (pcCase?.specs && "included_fans" in pcCase.specs) {
    const includedFans = (pcCase.specs as CaseSpecs).included_fans || 0;
    if (includedFans > 0) {
      total += PERIPHERAL_WATTAGE.CASE_FAN * includedFans;
    }
  }

  // Motherboard base + overhead del sistema (USB, audio, sensores, BIOS)
  total += PERIPHERAL_WATTAGE.MOTHERBOARD_BASE;
  total += PERIPHERAL_WATTAGE.SYSTEM_OVERHEAD;

  return Math.round(total);
}
