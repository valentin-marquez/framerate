/**
 * @module builder/rules
 *
 * Implementaciones de reglas de validación para el motor de compatibilidad.
 * Cada regla es independiente y puede ser habilitada/deshabilitada según necesidad.
 */

import type {
  BuildComponentsMap,
  BuildRule,
  CaseSpecs,
  CpuCoolerSpecs,
  CpuSpecs,
  GpuSpecs,
  MotherboardSpecs,
  PsuSpecs,
  RamSpecs,
  ValidationIssue,
} from "@framerate/db";
import { calculateEstimatedWattage } from "./engine";

/**
 * Regla 0: Completitud del Build
 *
 * Valida que el build tenga todos los componentes necesarios para funcionar.
 * Diferencia entre componentes críticos (error) y recomendados (warning).
 */
export const CompletenessRule: BuildRule = {
  name: "Completeness",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // 1. Componentes Críticos (Impiden boot/funcionamiento básico)
    if (!parts.cpu) {
      issues.push({
        code: "MISSING_COMPONENT",
        severity: "error",
        message: "Falta Procesador (CPU)",
        details: "El cerebro del computador es obligatorio.",
      });
    }

    if (!parts.motherboard) {
      issues.push({
        code: "MISSING_COMPONENT",
        severity: "error",
        message: "Falta Placa Madre",
        details: "Es necesaria para conectar todos los componentes.",
      });
    }

    if (!parts.ram) {
      issues.push({
        code: "MISSING_COMPONENT",
        severity: "error",
        message: "Falta Memoria RAM",
        details: "El sistema no puede arrancar sin memoria.",
      });
    }

    if (!parts.psu) {
      issues.push({
        code: "MISSING_COMPONENT",
        severity: "error",
        message: "Falta Fuente de Poder",
        details: "Energía necesaria para todos los componentes.",
      });
    }

    // Storage: Al menos uno (SSD o HDD)
    if (!parts.ssd && !parts.hdd) {
      issues.push({
        code: "MISSING_COMPONENT",
        severity: "error",
        message: "Falta Almacenamiento",
        details: "Necesitas al menos un SSD o Disco Duro para instalar el sistema operativo.",
      });
    }

    // 2. Validación de Video (GPU vs iGPU)
    if (!parts.gpu && parts.cpu) {
      const cpuSpecs = parts.cpu.specs as CpuSpecs;
      const hasIGPU = !!cpuSpecs.integrated_graphics;

      if (!hasIGPU) {
        issues.push({
          code: "MISSING_VIDEO_OUTPUT",
          severity: "error",
          message: "Falta salida de video",
          details: "El procesador seleccionado no tiene gráficos integrados. Necesitas una tarjeta de video dedicada.",
          componentA: parts.cpu.name,
        });
      } else {
        issues.push({
          code: "USING_INTEGRATED_GRAPHICS",
          severity: "info",
          message: "Usando gráficos integrados",
          details: `Se utilizarán los gráficos ${cpuSpecs.integrated_graphics} del procesador.`,
          componentA: parts.cpu.name,
        });
      }
    }

    // 3. Validación de Refrigeración (Cooler Stock vs Dedicado)
    if (!parts["cpu-cooler"] && parts.cpu) {
      const cpuSpecs = parts.cpu.specs as CpuSpecs;
      const includesCooler = cpuSpecs.includes_cooler;

      if (includesCooler === false) {
        issues.push({
          code: "MISSING_CPU_COOLER",
          severity: "error",
          message: "Falta Cooler de CPU",
          details:
            "Este procesador no incluye disipador de fábrica si seleccionas la version 'Tray' o 'WOF'. Necesitas comprar uno aparte.",
          componentA: parts.cpu.name,
        });
      } else if (includesCooler === true) {
        issues.push({
          code: "USING_STOCK_COOLER",
          severity: "info",
          message: "Usando cooler de stock",
          details: "Se utilizará el disipador incluido con el procesador.",
          componentA: parts.cpu.name,
        });
      } else {
        // Unknown
        issues.push({
          code: "UNKNOWN_COOLING",
          severity: "warning",
          message: "Verificar refrigeración",
          details: "No estamos seguros si este CPU incluye cooler. Te recomendamos agregar uno para asegurar.",
          componentA: parts.cpu.name,
        });
      }
    }

    // 4. Componentes Importantes pero no bloqueantes
    if (!parts.case) {
      issues.push({
        code: "MISSING_CASE",
        severity: "warning",
        message: "Falta Gabinete",
        details: "No tienes donde montar los componentes. Recomendado para proteger tu inversión.",
      });
    } else {
      // Validar Flujo de Aire (Ventiladores incluidos vs extra)
      const caseSpecs = parts.case.specs as CaseSpecs;
      const includedFans = caseSpecs.included_fans || 0;
      const extraFans = parts["case-fan"] ? parts["case-fan"].quantity || 1 : 0;
      const totalFans = includedFans + extraFans;

      if (totalFans === 0) {
        issues.push({
          code: "NO_CASE_FANS",
          severity: "warning",
          message: "Gabinete sin ventiladores",
          details:
            "Este gabinete no incluye ventiladores y no has agregado ninguno extra. Recomendamos mejorar el flujo de aire.",
          componentA: parts.case.name,
        });
      } else if (includedFans > 0 && extraFans === 0) {
        issues.push({
          code: "USING_INCLUDED_FANS",
          severity: "info",
          message: "Ventiladores incluidos",
          details: `El gabinete incluye ${includedFans} ventilador(es).`,
          componentA: parts.case.name,
        });
      }
    }

    return issues;
  },
};

/**
 * Normaliza un valor de socket para comparación.
 * Remueve espacios, guiones y convierte a minúsculas.
 */
function normalizeSocket(socket: string): string {
  return socket.toLowerCase().replace(/[\s-]/g, "");
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

    // Cast seguro porque conocemos la categoría
    const cpuSpecs = cpu.specs as CpuSpecs;
    const moboSpecs = mobo.specs as MotherboardSpecs;

    const cpuSocket = cpuSpecs.socket;
    const moboSocket = moboSpecs.socket;

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

    // Si no hay PSU, no validamos
    if (!psu) {
      return [];
    }

    // Calcular consumo estimado del sistema usando el motor centralizado
    const totalTdp = calculateEstimatedWattage(parts);

    // Obtener capacidad de la PSU
    const psuSpecs = psu.specs as PsuSpecs;
    const psuWatts = psuSpecs.wattage;

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
    const ramSpecs = ram.specs as RamSpecs;
    const moboSpecs = mobo.specs as MotherboardSpecs;

    const ramType = ramSpecs.type;
    const moboMemoryType = moboSpecs.memory?.type;

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
          message: `Tipo de RAM incompatible: ${ramType} no es compatible con el soporte de la placa (${moboMemoryType})`,
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

    const gpuSpecs = gpu.specs as GpuSpecs;
    const caseSpecs = pcCase.specs as CaseSpecs;

    const gpuLength = gpuSpecs.length_mm;
    const maxGpuLength = caseSpecs.max_gpu_length_mm;

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

    const coolerSpecs = cooler.specs as CpuCoolerSpecs;
    const caseSpecs = pcCase.specs as CaseSpecs;

    const coolerHeight = coolerSpecs.height_mm;
    const maxCoolerHeight = caseSpecs.max_cpu_cooler_height_mm;

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
  CompletenessRule,
  SocketCompatibilityRule,
  WattageRule,
  MemoryTypeRule,
  GpuClearanceRule,
  CoolerClearanceRule,
];
