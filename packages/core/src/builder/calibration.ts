/**
 * @module builder/calibration
 *
 * Tablas de calibración para estimación de rendimiento y consumo.
 * Mantiene la lógica heurística separada del motor para facilitar
 * tuning, testing y mantenimiento.
 */

import type { GpuSpecs } from "@framerate/db";

/**
 * Factores de rendimiento por microarquitectura de CPU.
 * Base de referencia: Zen 2 = 1.0
 */
export const CPU_GEN_FACTORS: Record<string, number> = {
  // AMD
  "Zen 5": 1.6,
  "Zen 4": 1.35,
  "Zen 3": 1.2,
  "Zen 2": 1.0,
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

/**
 * Factores de rendimiento por arquitectura de GPU.
 * Base aproximada: Pascal = 1.0
 */
export const GPU_ARCH_FACTORS: Record<string, number> = {
  // NVIDIA
  Blackwell: 2.6, // RTX 50
  "Ada Lovelace": 2.1, // RTX 40
  Ampere: 1.6, // RTX 30
  Turing: 1.3, // RTX 20 / GTX 16
  Pascal: 1.0, // GTX 10
  // AMD
  "RDNA 4": 2.2, // RX 9000
  "RDNA 3": 1.9, // RX 7000
  "RDNA 2": 1.5, // RX 6000
  RDNA: 1.2, // RX 5000
};

/**
 * Tabla de fallback de wattage para GPU cuando `tdp_w` es null.
 * Se evalúa en orden; el primer patrón que matchee el nombre se usa.
 */
export interface GpuWattageEntry {
  pattern: RegExp;
  watts: number;
}

export const GPU_WATTAGE_FALLBACK: GpuWattageEntry[] = [
  // NVIDIA RTX 50
  { pattern: /\b50?90\b/i, watts: 575 },
  { pattern: /\b5080\b/i, watts: 360 },
  { pattern: /\b5070\s*ti\b/i, watts: 300 },
  { pattern: /\b5070\b/i, watts: 250 },
  { pattern: /\b5060\s*ti\b/i, watts: 180 },
  { pattern: /\b5060\b/i, watts: 145 },
  // NVIDIA RTX 40
  { pattern: /\b4090\b/i, watts: 450 },
  { pattern: /\b4080\b/i, watts: 320 },
  { pattern: /\b4070\s*ti\b/i, watts: 285 },
  { pattern: /\b4070\b/i, watts: 200 },
  { pattern: /\b4060\s*ti\b/i, watts: 160 },
  { pattern: /\b4060\b/i, watts: 115 },
  // NVIDIA RTX 30
  { pattern: /\b3090\b/i, watts: 350 },
  { pattern: /\b3080\b/i, watts: 320 },
  { pattern: /\b3070\b/i, watts: 220 },
  { pattern: /\b3060\s*ti\b/i, watts: 200 },
  { pattern: /\b3060\b/i, watts: 170 },
  { pattern: /\b3050\b.*\b6\s*gb\b/i, watts: 75 },
  { pattern: /\b3050\b/i, watts: 130 },
  // AMD Radeon RX 9000
  { pattern: /\brx\s*9070\s*xt\b/i, watts: 304 },
  { pattern: /\brx\s*9070\b/i, watts: 220 },
  { pattern: /\brx\s*9060\b/i, watts: 180 },
  // AMD Radeon RX 7000
  { pattern: /\brx\s*7900\s*xtx\b/i, watts: 355 },
  { pattern: /\brx\s*7900\b/i, watts: 315 },
  { pattern: /\brx\s*7800\b/i, watts: 263 },
  { pattern: /\brx\s*7700\b/i, watts: 245 },
  { pattern: /\brx\s*7600\b/i, watts: 165 },
  // AMD Radeon RX 6000
  { pattern: /\b6950\b/i, watts: 335 },
  { pattern: /\b6900\b/i, watts: 300 },
  { pattern: /\b6800\b/i, watts: 250 },
  { pattern: /\b6750\b/i, watts: 250 },
  { pattern: /\b6700\b/i, watts: 230 },
  { pattern: /\b6650\b/i, watts: 180 },
  { pattern: /\b6600\b/i, watts: 132 },
  // Legacy NVIDIA
  { pattern: /\b1660\b/i, watts: 125 },
  { pattern: /\b1650\b/i, watts: 75 },
  { pattern: /\b1050\b/i, watts: 75 },
  { pattern: /\b1030\b/i, watts: 30 },
];

/**
 * Wattage por defecto cuando ningún patrón matchea.
 */
export const GPU_WATTAGE_DEFAULT = 150;

/**
 * Factores de "potencia bajo carga" para estimación realista de consumo.
 *
 * La suma simple de TDPs nominales (lo que el fabricante imprime en la caja)
 * subestima el consumo real porque no captura:
 *   - Boost sostenido (PPT en AMD, PL2 en Intel) que puede llegar a 1.3× TDP
 *   - Transient spikes en GPUs modernas (Ada/Blackwell/RDNA3+) que tocan
 *     1.4–1.7× TDP por milisegundos y obligan a dimensionar la PSU para
 *     evitar OCP trips. Ej.: NVIDIA recomienda 650W para una RTX 5070 (TDP 250W).
 *
 * Estos factores se aplican en `calculateEstimatedWattage` para acercar
 * la estimación al valor real medido por reviewers (TechPowerUp, GN, etc.).
 */
export const POWER_FACTORS = {
  /** CPU bajo carga (PPT/PL2). Aplica a todos los CPUs. */
  CPU_BOOST: 1.3,
  /** GPUs modernas con spikes transientes pronunciados. */
  GPU_TRANSIENT_MODERN: 1.4,
  /** GPUs legacy (Pascal y anteriores) con consumo más estable. */
  GPU_TRANSIENT_LEGACY: 1.2,
} as const;

/**
 * Arquitecturas de GPU consideradas "modernas" para el factor transient.
 * Ada/Blackwell/RDNA 3+ son notorias por sus spikes de potencia.
 */
const MODERN_GPU_ARCHITECTURES = new Set(["Blackwell", "Ada Lovelace", "Ampere", "RDNA 4", "RDNA 3"]);

/**
 * Devuelve el multiplicador de transient apropiado según arquitectura.
 */
export function getGpuTransientFactor(architecture: string | null): number {
  if (architecture && MODERN_GPU_ARCHITECTURES.has(architecture)) {
    return POWER_FACTORS.GPU_TRANSIENT_MODERN;
  }
  return POWER_FACTORS.GPU_TRANSIENT_LEGACY;
}

/**
 * Consumo base por componente periférico (W). Valores conservadores
 * basados en mediciones de reviewers para componentes modernos.
 */
export const PERIPHERAL_WATTAGE = {
  /** Consumo por módulo de RAM (DDR4 ~3W, DDR5 ~5W; usamos 7 conservador). */
  RAM_PER_MODULE: 7,
  /** SSD bajo carga sostenida (NVMe puede llegar a 8W; SATA ~3W; usamos 5 promedio). */
  SSD_PER_UNIT: 5,
  /** HDD 3.5" bajo carga (motor + cabezales). */
  HDD_PER_UNIT: 10,
  /** AIO: bomba (5-10W) + fans (3-9W) + RGB (5-10W). */
  COOLER_AIO: 25,
  /** Air cooler: solo el fan. */
  COOLER_AIR: 7,
  /** Ventilador adicional de chasis. */
  CASE_FAN: 4,
  /** Motherboard moderna con VRMs activos, RGB, audio, NIC. */
  MOTHERBOARD_BASE: 60,
  /** Overhead del sistema: USB devices, audio jack, BIOS, sensores. */
  SYSTEM_OVERHEAD: 30,
} as const;

/**
 * Estima el wattage de una GPU a partir del nombre, usando la tabla de fallback.
 */
export function estimateGpuWattageFromName(name: string): number {
  for (const entry of GPU_WATTAGE_FALLBACK) {
    if (entry.pattern.test(name)) {
      return entry.watts;
    }
  }
  return GPU_WATTAGE_DEFAULT;
}

/**
 * Reglas de inferencia de arquitectura GPU desde el chipset.
 * Se evalúan en orden; primero que matchee gana.
 */
const GPU_ARCH_PATTERNS: Array<{ pattern: RegExp; arch: string }> = [
  // NVIDIA
  { pattern: /\brtx\s*50\d{2}\b/i, arch: "Blackwell" },
  { pattern: /\brtx\s*40\d{2}\b/i, arch: "Ada Lovelace" },
  { pattern: /\brtx\s*30\d{2}\b/i, arch: "Ampere" },
  { pattern: /\brtx\s*20\d{2}\b/i, arch: "Turing" },
  { pattern: /\bgtx\s*16\d{2}\b/i, arch: "Turing" },
  { pattern: /\bgtx\s*10\d{2}\b/i, arch: "Pascal" },
  // AMD: "RX 9xxx", "RX 7xxx", etc. Ojo que "RX 5xxx" debe ir antes que "RX 7xxx" no importa,
  // pero "RX 90xx" debe matchear como RDNA 4 antes que cualquier otra cosa.
  { pattern: /\brx\s*9\d{3}\b/i, arch: "RDNA 4" },
  { pattern: /\brx\s*7\d{3}\b/i, arch: "RDNA 3" },
  { pattern: /\brx\s*6\d{3}\b/i, arch: "RDNA 2" },
  { pattern: /\brx\s*5\d{3}\b/i, arch: "RDNA" },
];

/**
 * Infiere la arquitectura de una GPU a partir de su chipset (e.g. "GeForce RTX 5070").
 * Devuelve null si no se puede inferir.
 */
export function inferGpuArchitecture(specs: GpuSpecs): string | null {
  const chipset = specs.chipset;
  if (!chipset) return null;
  for (const { pattern, arch } of GPU_ARCH_PATTERNS) {
    if (pattern.test(chipset)) {
      return arch;
    }
  }
  return null;
}

/**
 * Devuelve la arquitectura efectiva de una GPU: usa `specs.architecture` si está presente,
 * sino intenta inferirla desde el chipset.
 */
export function resolveGpuArchitecture(specs: GpuSpecs): string | null {
  if (specs.architecture) return specs.architecture;
  return inferGpuArchitecture(specs);
}
