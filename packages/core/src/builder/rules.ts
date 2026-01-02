/**
 * @module builder/rules
 *
 * Implementaciones de reglas de validación para el motor de compatibilidad.
 * Cada regla es independiente y puede ser habilitada/deshabilitada según necesidad.
 */

import type { BuildComponentsMap, BuildRule, ValidationIssue } from "@framerate/db";

/**
 * Normaliza un valor de socket para comparación.
 * Remueve espacios, guiones y convierte a minúsculas.
 */
function normalizeSocket(socket: string): string {
  return socket.toLowerCase().replace(/[\s-]/g, "");
}

/**
 * Parsea un valor de potencia a número.
 * Soporta: "120W", "120 watts", 120
 */
function parseWatts(value: string | number | undefined): number {
  if (!value) return 0;
  if (typeof value === "number") return value;

  const match = value.toString().match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/**
 * Regla 1: Compatibilidad de Socket (CPU vs Motherboard)
 *
 * Valida que el socket del CPU sea compatible con el de la motherboard.
 * Aplica normalización para evitar falsos negativos por diferencias de formato.
 */
export const SocketCompatibilityRule: BuildRule = {
  name: "SocketCompatibility",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const cpu = parts.cpu;
    const mobo = parts.motherboard;

    // Si falta alguno, no podemos validar
    if (!cpu || !mobo) {
      return [];
    }

    // Extraer sockets de specs
    const cpuSpecs = cpu.specs as Record<string, unknown>;
    const moboSpecs = mobo.specs as Record<string, unknown>;

    const cpuSocket = cpuSpecs?.socket as string | undefined;
    const moboSocket = moboSpecs?.socket as string | undefined;

    // Si no tenemos información de socket, advertir
    if (!cpuSocket || !moboSocket) {
      return [
        {
          code: "UNKNOWN_SOCKET",
          severity: "warning",
          message: "No se pudo verificar la compatibilidad del socket",
          details: "Faltan datos de socket en CPU o motherboard. Verifica manualmente.",
          componentA: cpu.name,
          componentB: mobo.name,
        },
      ];
    }

    // Normalizar y comparar
    const normalizedCpuSocket = normalizeSocket(cpuSocket);
    const normalizedMoboSocket = normalizeSocket(moboSocket);

    if (normalizedCpuSocket !== normalizedMoboSocket) {
      return [
        {
          code: "SOCKET_MISMATCH",
          severity: "error",
          message: `Socket incompatible: CPU usa ${cpuSocket} pero motherboard es ${moboSocket}`,
          details: "El procesador no encajará físicamente en esta placa madre.",
          componentA: cpu.name,
          componentB: mobo.name,
        },
      ];
    }

    return [];
  },
};

/**
 * Regla 2: Compatibilidad de Potencia (PSU vs Sistema)
 *
 * Valida que la fuente de poder tenga suficiente capacidad para el sistema.
 * Aplica regla de seguridad: se recomienda 20% de margen sobre consumo estimado.
 */
export const WattageRule: BuildRule = {
  name: "WattageCompatibility",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const psu = parts.psu;
    const gpu = parts.gpu;
    const cpu = parts.cpu;

    // Si no hay PSU, no validamos (puede que aún no lo hayan seleccionado)
    if (!psu) {
      return [];
    }

    // Calcular consumo estimado del sistema
    let totalTdp = 0;

    // CPU TDP
    if (cpu?.specs) {
      const cpuSpecs = cpu.specs as Record<string, unknown>;
      totalTdp += parseWatts(cpuSpecs.tdp as string | number);
    }

    // GPU TDP (generalmente el mayor consumidor)
    if (gpu?.specs) {
      const gpuSpecs = gpu.specs as Record<string, unknown>;
      totalTdp += parseWatts(gpuSpecs.tdp as string | number);
    }

    // Estimación base para otros componentes (RAM, storage, fans, etc.)
    totalTdp += 50;

    // Obtener capacidad de la PSU
    const psuSpecs = psu.specs as Record<string, unknown>;
    const psuWatts = parseWatts((psuSpecs?.power_output || psuSpecs?.watts || psuSpecs?.wattage) as string | number);

    // Si no tenemos datos de la PSU, advertir
    if (!psuWatts) {
      return [
        {
          code: "UNKNOWN_POWER",
          severity: "warning",
          message: "No se pudo determinar la capacidad de la fuente",
          details: "Verifica manualmente que la PSU tenga suficiente capacidad.",
          componentA: psu.name,
        },
      ];
    }

    // Validar: PSU debe ser mayor que el consumo
    if (psuWatts < totalTdp) {
      return [
        {
          code: "INSUFFICIENT_WATTAGE",
          severity: "error",
          message: `Fuente insuficiente: ${psuWatts}W vs ~${totalTdp}W de consumo estimado`,
          details: `Se recomienda una fuente de al menos ${Math.ceil(totalTdp * 1.2)}W para este build.`,
          componentA: psu.name,
        },
      ];
    }

    // Validar margen de seguridad (20%)
    const recommendedWattage = totalTdp * 1.2;
    if (psuWatts < recommendedWattage) {
      return [
        {
          code: "LOW_WATTAGE_HEADROOM",
          severity: "warning",
          message: `Poco margen de potencia: ${psuWatts}W vs ~${Math.ceil(recommendedWattage)}W recomendado`,
          details: "La fuente funcionará, pero no tendrás mucho margen para overclocking o upgrades futuros.",
          componentA: psu.name,
        },
      ];
    }

    return [];
  },
};

/**
 * Regla 3: Compatibilidad de Memoria (RAM vs Motherboard)
 *
 * Valida que el tipo de RAM sea compatible con la motherboard.
 * Ejemplos: DDR4 vs DDR5, velocidades soportadas, etc.
 */
export const MemoryTypeRule: BuildRule = {
  name: "MemoryCompatibility",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const ram = parts.ram;
    const mobo = parts.motherboard;

    // Si falta alguno, no validamos
    if (!ram || !mobo) {
      return [];
    }

    // Extraer especificaciones
    const ramSpecs = ram.specs as Record<string, unknown>;
    const moboSpecs = mobo.specs as Record<string, unknown>;

    const ramType = ramSpecs?.memory_type || ramSpecs?.type;
    const moboMemoryType = moboSpecs?.memory_type || moboSpecs?.memory_support;

    // Si no tenemos información, advertir
    if (!ramType || !moboMemoryType) {
      return [
        {
          code: "UNKNOWN_MEMORY_TYPE",
          severity: "warning",
          message: "No se pudo verificar la compatibilidad de la RAM",
          details: "Faltan datos de tipo de memoria. Verifica manualmente.",
          componentA: ram.name,
          componentB: mobo.name,
        },
      ];
    }

    // Normalizar tipos (DDR4, DDR5, etc.)
    const ramTypeNorm = ramType.toString().toUpperCase().replace(/[\s-]/g, "");
    const moboTypeNorm = moboMemoryType.toString().toUpperCase().replace(/[\s-]/g, "");

    // Validar tipo de memoria
    if (!moboTypeNorm.includes(ramTypeNorm)) {
      return [
        {
          code: "MEMORY_TYPE_MISMATCH",
          severity: "error",
          message: `Tipo de RAM incompatible: ${ramType} no es compatible con ${moboMemoryType}`,
          details: "La RAM no encajará físicamente en esta motherboard.",
          componentA: ram.name,
          componentB: mobo.name,
        },
      ];
    }

    // TODO: Validar velocidad de RAM (requiere más datos en specs)
    // Por ahora solo validamos el tipo base

    return [];
  },
};

/**
 * Regla 4: Compatibilidad Física - GPU (Tamaño de GPU vs Case)
 *
 * Valida que la GPU quepa físicamente en el case.
 */
export const GpuClearanceRule: BuildRule = {
  name: "GpuClearance",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const gpu = parts.gpu;
    const pcCase = parts.case;

    if (!gpu || !pcCase) {
      return [];
    }

    const gpuSpecs = gpu.specs as Record<string, unknown>;
    const caseSpecs = pcCase.specs as Record<string, unknown>;

    const gpuLength = parseWatts(gpuSpecs?.length as string | number);
    const maxGpuLength = parseWatts(caseSpecs?.max_gpu_length as string | number);

    if (!gpuLength || !maxGpuLength) {
      return [];
    }

    if (gpuLength > maxGpuLength) {
      return [
        {
          code: "GPU_TOO_LONG",
          severity: "error",
          message: `GPU demasiado larga: ${gpuLength}mm vs ${maxGpuLength}mm máximo del case`,
          details: "La tarjeta gráfica no cabrá en este gabinete.",
          componentA: gpu.name,
          componentB: pcCase.name,
        },
      ];
    }

    return [];
  },
};

/**
 * Regla 5: Compatibilidad Física - CPU Cooler (Altura del cooler vs Case)
 *
 * Valida que el cooler quepa en el case.
 */
export const CoolerClearanceRule: BuildRule = {
  name: "CoolerClearance",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const cooler = parts["cpu-cooler"];
    const pcCase = parts.case;

    if (!cooler || !pcCase) {
      return [];
    }

    const coolerSpecs = cooler.specs as Record<string, unknown>;
    const caseSpecs = pcCase.specs as Record<string, unknown>;

    const coolerHeight = parseWatts(coolerSpecs?.height as string | number);
    const maxCoolerHeight = parseWatts(caseSpecs?.max_cooler_height as string | number);

    if (!coolerHeight || !maxCoolerHeight) {
      return [];
    }

    if (coolerHeight > maxCoolerHeight) {
      return [
        {
          code: "COOLER_TOO_TALL",
          severity: "error",
          message: `Cooler demasiado alto: ${coolerHeight}mm vs ${maxCoolerHeight}mm máximo del case`,
          details: "El disipador no cabrá en este gabinete.",
          componentA: cooler.name,
          componentB: pcCase.name,
        },
      ];
    }

    return [];
  },
};

/**
 * Array con todas las reglas disponibles.
 * Puedes importar este array para inicializar el motor con todas las reglas.
 */
export const ALL_RULES: BuildRule[] = [
  SocketCompatibilityRule,
  WattageRule,
  MemoryTypeRule,
  GpuClearanceRule,
  CoolerClearanceRule,
];
