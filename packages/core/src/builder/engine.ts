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
  CompatibilityStatus,
  CpuSpecs,
  GpuSpecs,
  PerformanceEstimation,
  ValidationIssue,
} from "@framerate/db";

// Constantes de calibración de rendimiento por generación/arquitectura
const CPU_GEN_FACTORS: Record<string, number> = {
  // AMD
  "Zen 5": 1.6,
  "Zen 4": 1.35,
  "Zen 3": 1.2,
  "Zen 2": 1.0, // Base de referencia
  "Zen+": 0.9,
  Zen: 0.8,
  // Intel
  "Arrow Lake": 1.5,
  "Core Ultra 200": 1.5,
  "Raptor Lake Refresh": 1.45,
  "Raptor Lake": 1.4,
  "Alder Lake": 1.3,
  "Rocket Lake": 1.1,
  "Comet Lake": 1.05,
  "Coffee Lake": 1.0,
};

const GPU_ARCH_FACTORS: Record<string, number> = {
  // NVIDIA
  Blackwell: 2.6, // RTX 50 series
  "Ada Lovelace": 2.1, // RTX 40 series
  Ampere: 1.6, // RTX 30 series
  Turing: 1.3, // RTX 20/16xx series
  Pascal: 1.0, // GTX 10 series
  // AMD
  "RDNA 3": 1.9,
  "RDNA 2": 1.5,
  RDNA: 1.2,
};

/**
 * Motor principal de análisis de compatibilidad.
 *
 * Ejecuta una serie de reglas de validación sobre un conjunto de componentes
 * y devuelve un análisis completo con el estado de compatibilidad y problemas detectados.
 *
 * @example
 * ```typescript
 * const engine = new CompatibilityEngine([
 *   SocketCompatibilityRule,
 *   WattageRule,
 *   MemoryTypeRule
 * ]);
 *
 * const analysis = engine.run({
 *   cpu: { ...productData, specs: { socket: "AM5", tdp_w: 120 } },
 *   motherboard: { ...productData, specs: { socket: "AM5" } }
 * });
 *
 * if (analysis.status === "incompatible") {
 *   console.error("Build inválido:", analysis.issues);
 * }
 * ```
 */
export class CompatibilityEngine {
  private rules: BuildRule[];

  /**
   * Crea una nueva instancia del motor con las reglas especificadas.
   *
   * @param rules Array de reglas a ejecutar durante el análisis
   */
  constructor(rules: BuildRule[]) {
    this.rules = rules;
  }

  /**
   * Ejecuta todas las reglas sobre el conjunto de componentes.
   *
   * @param components Mapa de componentes a analizar
   * @returns Análisis completo con estado y problemas detectados
   */
  run(components: BuildComponentsMap): BuildAnalysis {
    const issues: ValidationIssue[] = [];

    // Ejecutar todas las reglas y acumular problemas
    for (const rule of this.rules) {
      try {
        const ruleIssues = rule.validate(components);
        issues.push(...ruleIssues);
      } catch (error) {
        // Si una regla falla, registrar como warning interno
        console.error(`Rule ${rule.name} failed:`, error);
        issues.push({
          code: "INTERNAL_VALIDATION_ERROR",
          severity: "warning",
          message: `No se pudo validar: ${rule.name}`,
          details: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    // Calcular consumo estimado de energía
    const estimatedWattage = this.calculateWattage(components);

    // Determinar estado general basado en la severidad de los problemas
    const status = this.determineStatus(issues);

    // Calcular estimación de rendimiento
    const performance = this.estimatePerformance(components);

    return {
      status,
      estimatedWattage,
      performance,
      issues,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Estima el rendimiento del build para Gaming.
   *
   * @param components Mapa de componentes
   * @returns Estimación de rendimiento
   */
  public estimatePerformance(components: BuildComponentsMap): PerformanceEstimation {
    const cpu = components.cpu;
    const gpu = components.gpu;

    // 1. Calcular CPU Score
    let cpuScore = 0;
    if (cpu?.specs) {
      const specs = cpu.specs as any;
      const microArch = specs.microarchitecture || "Zen 2"; // Default fallback
      const factor = CPU_GEN_FACTORS[microArch] || 1.0;

      const cores = specs.cores?.total ?? specs.cores ?? 4;
      const threads = specs.cores?.threads ?? specs.threads ?? cores;
      const boost = specs.clocks?.boost_ghz ?? specs.boost_clock_ghz ?? 3.5;

      cpuScore = Math.round((cores * 0.7 + threads * 0.3) * boost * factor * 110);
    }

    // 2. Calcular GPU Score
    let gpuScore = 0;
    if (gpu?.specs) {
      const specs = gpu.specs as any;
      const arch = specs.architecture || "Pascal"; // Default fallback
      const factor = GPU_ARCH_FACTORS[arch] || 1.2;

      const vram = specs.memory_gb ?? specs.vram_gb ?? 4;
      const bus = specs.memory_bus_bit ?? specs.memory_bus_bits ?? 128; // Default 128 bit
      const clockMhz = specs.core_boost_clock_mhz ?? specs.core_boost_mhz ?? 1500;
      const clock = clockMhz / 1000; // GHz

      gpuScore = Math.round(vram * (bus / 64) * clock * factor * 65);
    }

    // 3. Score Combinado (Ponderado 85% GPU / 15% CPU para Gaming)
    // Evitar división por cero
    const safeCpuScore = cpuScore || 1000;
    const safeGpuScore = gpuScore || 1000;

    const totalScore = Math.round(1 / (0.85 / safeGpuScore + 0.15 / safeCpuScore));

    // Determinar Tier
    let tier = "Entry";
    if (totalScore > 25000) tier = "4K / Enthusiast";
    else if (totalScore > 20000) tier = "Elite";
    else if (totalScore > 10000) tier = "High / 1440p";
    else if (totalScore > 5000) tier = "Mid / 1080p";
    else tier = "Entry / Ofimática";

    return {
      cpuScore,
      gpuScore,
      totalScore,
      tier,
    };
  }

  /**
   * Calcula el consumo total estimado de energía del build.
   *
   * @param components Mapa de componentes
   * @returns Consumo estimado en Watts
   */
  private calculateWattage(components: BuildComponentsMap): number {
    return calculateEstimatedWattage(components);
  }

  /**
   * Determina el estado general del build basado en los problemas encontrados.
   *
   * @param issues Lista de problemas
   * @returns Estado de compatibilidad
   */
  private determineStatus(issues: ValidationIssue[]): CompatibilityStatus {
    if (issues.length === 0) return "valid";

    const hasErrors = issues.some((issue) => issue.severity === "error");
    if (hasErrors) return "incompatible";

    const hasWarnings = issues.some((issue) => issue.severity === "warning");
    if (hasWarnings) return "warning";

    return "valid";
  }

  /**
   * Agrega una regla adicional al motor.
   *
   * @param rule Regla a agregar
   */
  addRule(rule: BuildRule): void {
    this.rules.push(rule);
  }

  /**
   * Remueve una regla del motor por nombre.
   *
   * @param ruleName Nombre de la regla a remover
   */
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter((rule) => rule.name !== ruleName);
  }

  /**
   * Obtiene la lista de reglas activas.
   *
   * @returns Array de nombres de reglas
   */
  getActiveRules(): string[] {
    return this.rules.map((rule) => rule.name);
  }
}

/**
 * Calcula el consumo total estimado de energía del build.
 * Implementa lógica de fallback para componentes sin datos de consumo.
 */
export function calculateEstimatedWattage(components: BuildComponentsMap): number {
  let total = 0;

  // CPU TDP
  const cpu = components.cpu;
  if (cpu?.specs && "tdp_w" in cpu.specs) {
    total += (cpu.specs as CpuSpecs).tdp_w || 0;
  }

  // GPU TDP con Fallback System
  const gpu = components.gpu;
  if (gpu) {
    const gpuSpecs = gpu.specs as GpuSpecs;
    if (gpuSpecs.tdp_w) {
      total += gpuSpecs.tdp_w;
    } else {
      // Fallback basado en el nombre del modelo
      const name = gpu.name.toLowerCase();

      // NVIDIA RTX 40 Series
      if (name.includes("4090")) total += 450;
      else if (name.includes("4080")) total += 320;
      else if (name.includes("4070 ti")) total += 285;
      else if (name.includes("4070")) total += 200;
      else if (name.includes("4060 ti")) total += 160;
      else if (name.includes("4060")) total += 115;
      // NVIDIA RTX 30 Series
      else if (name.includes("3090")) total += 350;
      else if (name.includes("3080")) total += 320;
      else if (name.includes("3070")) total += 220;
      else if (name.includes("3060 ti")) total += 200;
      else if (name.includes("3060")) total += 170;
      else if (name.includes("3050") && name.includes("6gb")) total += 75;
      else if (name.includes("3050")) total += 130;
      // AMD Radeon RX 6000 Series
      else if (name.includes("6950")) total += 335;
      else if (name.includes("6900")) total += 300;
      else if (name.includes("6800")) total += 250;
      else if (name.includes("6750")) total += 250;
      else if (name.includes("6700")) total += 230;
      else if (name.includes("6650")) total += 180;
      else if (name.includes("6600")) total += 132;
      // Gamas de Entrada / Legacy
      else if (name.includes("1660")) total += 125;
      else if (name.includes("1650")) total += 75;
      else if (name.includes("1050")) total += 75;
      else if (name.includes("1030")) total += 30;
      // Fallback genérico de seguridad
      else total += 150;
    }
  }

  // RAM: ~5W por módulo
  if (components.ram) {
    total += 5 * (components.ram.quantity || 1);
  }

  // Storage: ~5W por unidad (SSD) / ~8W (HDD)
  if (components.ssd) {
    total += 5 * (components.ssd.quantity || 1);
  }
  if (components.hdd) {
    total += 8 * (components.hdd.quantity || 1);
  }

  // CPU Cooler: Diferenciación Aire vs AIO
  const cooler = components["cpu-cooler"];
  if (cooler) {
    const name = cooler.name.toLowerCase();
    const isAio = name.includes("liquid") || name.includes("aio") || name.includes("water");

    const watts = isAio ? 15 : 5;
    total += watts * (cooler.quantity || 1);
  }

  // Case Fans: ~5W cada uno (incluidos en gabinete + comprados aparte)
  if (components["case-fan"]) {
    total += 5 * (components["case-fan"].quantity || 1);
  }

  // Si el gabinete incluye ventiladores, sumar su consumo
  const pcCase = components.case;
  if (pcCase?.specs && "included_fans" in pcCase.specs) {
    const includedFans = (pcCase.specs as any).included_fans || 0;
    if (includedFans > 0) {
      total += 5 * includedFans;
    }
  }

  // Motherboard: ~50W base
  total += 50;

  return Math.round(total);
}
