/**
 * @module builder/engine
 *
 * Motor de compatibilidad para validar builds de PC.
 * Implementa el patrón Chain of Responsibility para ejecutar
 * múltiples reglas de validación sobre un conjunto de componentes.
 */

import type { BuildAnalysis, BuildComponentsMap, BuildRule, CompatibilityStatus, ValidationIssue } from "@framerate/db";

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
 *   cpu: { ...productData, specs: { socket: "AM5", tdp: 120 } },
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

    return {
      status,
      estimatedWattage,
      issues,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Calcula el consumo total estimado de energía del build.
   *
   * @param components Mapa de componentes
   * @returns Consumo estimado en Watts
   */
  private calculateWattage(components: BuildComponentsMap): number {
    let total = 0;

    // CPU TDP
    const cpu = components.cpu;
    if (cpu?.specs && typeof cpu.specs === "object" && "tdp" in cpu.specs) {
      total += this.parseWatts(cpu.specs.tdp as string | number);
    }

    // GPU TDP
    const gpu = components.gpu;
    if (gpu?.specs && typeof gpu.specs === "object" && "tdp" in gpu.specs) {
      total += this.parseWatts(gpu.specs.tdp as string | number);
    }

    // Estimación base para otros componentes
    // RAM: ~5W por módulo
    if (components.ram) total += 5;

    // Storage: ~5W por unidad
    if (components.ssd) total += 5;
    if (components.hdd) total += 8;

    // Coolers y fans: ~5W cada uno
    if (components["cpu-cooler"]) total += 5;
    if (components["case-fan"]) total += 5;

    // Motherboard: ~50W base
    total += 50;

    return Math.round(total);
  }

  /**
   * Convierte un valor de potencia a número.
   * Soporta formatos como: "120W", "120", 120
   *
   * @param value Valor a convertir
   * @returns Potencia en Watts o 0 si no se puede parsear
   */
  private parseWatts(value: string | number | undefined): number {
    if (!value) return 0;
    if (typeof value === "number") return value;

    const match = value.toString().match(/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
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
