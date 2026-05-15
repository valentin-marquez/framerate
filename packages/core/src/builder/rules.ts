/**
 * @module builder/rules
 *
 * Implementaciones de reglas de validación para el motor de compatibilidad.
 * Cada regla es independiente y puede ser habilitada/deshabilitada según necesidad.
 */

import type {
  BuildComponentsMap,
  BuildProduct,
  BuildRule,
  CaseSpecs,
  CpuCoolerSpecs,
  CpuSpecs,
  GpuSpecs,
  MotherboardSpecs,
  PsuSpecs,
  RamSpecs,
  StorageSpecs,
  ValidationIssue,
} from "@framerate/db";
import { _registerDefaultRules, calculateEstimatedWattage } from "./engine";

/**
 * Construye un issue INSUFFICIENT_DATA estandarizado.
 */
function insufficientData(componentName: string, missingField: string, message: string): ValidationIssue {
  return {
    code: "INSUFFICIENT_DATA",
    severity: "info",
    message,
    componentA: componentName,
    details: `Falta dato: ${missingField}`,
  };
}

/**
 * Regla 0: Completitud del Build
 */
export const CompletenessRule: BuildRule = {
  name: "Completeness",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // 1. Componentes Críticos
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

    if (!parts.ssd && !parts.hdd) {
      issues.push({
        code: "MISSING_COMPONENT",
        severity: "error",
        message: "Falta Almacenamiento",
        details: "Necesitas al menos un SSD o Disco Duro para instalar el sistema operativo.",
      });
    }

    // 2. Salida de video
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

    // 3. Refrigeración
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
        issues.push({
          code: "UNKNOWN_COOLING",
          severity: "warning",
          message: "Verificar refrigeración",
          details: "No estamos seguros si este CPU incluye cooler. Te recomendamos agregar uno para asegurar.",
          componentA: parts.cpu.name,
        });
      }
    }

    // 4. Case y ventiladores
    if (!parts.case) {
      issues.push({
        code: "MISSING_CASE",
        severity: "warning",
        message: "Falta Gabinete",
        details: "No tienes donde montar los componentes. Recomendado para proteger tu inversión.",
      });
    } else {
      const caseSpecs = parts.case.specs as CaseSpecs;
      const includedFans = caseSpecs.included_fans;
      const extraFans = parts["case-fan"] ? parts["case-fan"].quantity || 1 : 0;

      // Si no sabemos cuántos ventiladores incluye el case y el usuario no
      // agregó extra, no podemos determinar si hay flujo de aire — emitimos
      // INSUFFICIENT_DATA en vez del falso positivo NO_CASE_FANS.
      if (typeof includedFans !== "number") {
        if (extraFans === 0) {
          issues.push(
            insufficientData(
              parts.case.name,
              "case.included_fans",
              "No podemos verificar el flujo de aire del gabinete (faltan datos de ventiladores incluidos).",
            ),
          );
        }
      } else {
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
    }

    return issues;
  },
};

/**
 * Normaliza un valor de socket: minúsculas, sin espacios ni guiones.
 */
function normalizeSocket(socket: string): string {
  return socket.toLowerCase().replace(/[\s-]/g, "");
}

/**
 * Normaliza un form-factor: minúsculas, sin espacios ni guiones.
 */
function normalizeFormFactor(value: string): string {
  return value.toLowerCase().replace(/[\s-]/g, "");
}

/**
 * Regla 1: Compatibilidad de Socket (CPU vs Motherboard)
 */
export const SocketCompatibilityRule: BuildRule = {
  name: "SocketCompatibility",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const cpu = parts.cpu;
    const mobo = parts.motherboard;

    if (!cpu || !mobo) return [];

    const cpuSpecs = cpu.specs as CpuSpecs;
    const moboSpecs = mobo.specs as MotherboardSpecs;

    const cpuSocket = cpuSpecs.socket;
    const moboSocket = moboSpecs.socket;

    if (!cpuSocket || !moboSocket) {
      const missing = !cpuSocket ? "cpu.socket" : "motherboard.socket";
      return [
        insufficientData(
          !cpuSocket ? cpu.name : mobo.name,
          missing,
          "No se pudo verificar la compatibilidad del socket por falta de datos.",
        ),
      ];
    }

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
 */
export const WattageRule: BuildRule = {
  name: "WattageCompatibility",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const psu = parts.psu;
    if (!psu) return [];

    const totalTdp = calculateEstimatedWattage(parts);
    const psuSpecs = psu.specs as PsuSpecs;
    const psuWatts = psuSpecs.wattage;

    if (!psuWatts) {
      return [insufficientData(psu.name, "psu.wattage", "No se pudo determinar la capacidad de la fuente.")];
    }

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
 * Regla 3: Tipo de RAM compatible con la motherboard.
 */
export const MemoryTypeRule: BuildRule = {
  name: "MemoryCompatibility",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const ram = parts.ram;
    const mobo = parts.motherboard;
    if (!ram || !mobo) return [];

    const ramSpecs = ram.specs as RamSpecs;
    const moboSpecs = mobo.specs as MotherboardSpecs;

    const ramType = ramSpecs.type;
    const moboMemoryType = moboSpecs.memory?.type;

    if (!ramType || !moboMemoryType) {
      const missing = !ramType ? "ram.type" : "motherboard.memory.type";
      return [
        insufficientData(
          !ramType ? ram.name : mobo.name,
          missing,
          "No se pudo verificar la compatibilidad del tipo de RAM.",
        ),
      ];
    }

    const ramTypeNorm = ramType.toString().toUpperCase().replace(/[\s-]/g, "");
    const moboTypeNorm = moboMemoryType.toString().toUpperCase().replace(/[\s-]/g, "");

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

    return [];
  },
};

/**
 * Regla 4: Largo de la GPU vs largo máximo soportado por el case.
 */
export const GpuClearanceRule: BuildRule = {
  name: "GpuClearance",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const gpu = parts.gpu;
    const pcCase = parts.case;
    if (!gpu || !pcCase) return [];

    const gpuSpecs = gpu.specs as GpuSpecs;
    const caseSpecs = pcCase.specs as CaseSpecs;

    const gpuLength = gpuSpecs.length_mm;
    const maxGpuLength = caseSpecs.max_gpu_length_mm;

    if (typeof gpuLength !== "number" || typeof maxGpuLength !== "number") {
      const missing = typeof gpuLength !== "number" ? "gpu.length_mm" : "case.max_gpu_length_mm";
      return [
        insufficientData(
          typeof gpuLength !== "number" ? gpu.name : pcCase.name,
          missing,
          "No se pudo verificar que la GPU quepa en el gabinete.",
        ),
      ];
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
 * Regla 5: Altura del cooler vs altura máxima del case.
 */
export const CoolerClearanceRule: BuildRule = {
  name: "CoolerClearance",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const cooler = parts["cpu-cooler"];
    const pcCase = parts.case;
    if (!cooler || !pcCase) return [];

    const coolerSpecs = cooler.specs as CpuCoolerSpecs;
    const caseSpecs = pcCase.specs as CaseSpecs;

    const coolerHeight = coolerSpecs.height_mm;
    const maxCoolerHeight = caseSpecs.max_cpu_cooler_height_mm;

    // Si es AIO no tiene sentido validar altura del disipador.
    if (coolerSpecs.type === "AIO" || coolerSpecs.type === "Custom Loop") return [];

    if (typeof coolerHeight !== "number" || typeof maxCoolerHeight !== "number") {
      const missing = typeof coolerHeight !== "number" ? "cpu-cooler.height_mm" : "case.max_cpu_cooler_height_mm";
      return [
        insufficientData(
          typeof coolerHeight !== "number" ? cooler.name : pcCase.name,
          missing,
          "No se pudo verificar que el cooler quepa en el gabinete.",
        ),
      ];
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
 * Regla 6: Conectores PSU compatibles con los requerimientos de la GPU.
 *
 * Compara `gpu.specs.power_connectors` (counts de cada tipo) con
 * `psu.specs.connectors`. Asume que `pcie_6_plus_2_pin` cubre tanto 6 como 8 pin
 * (es el conector universal moderno).
 */
export const PsuConnectorRule: BuildRule = {
  name: "PsuConnectorCompatibility",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const gpu = parts.gpu;
    const psu = parts.psu;
    if (!gpu || !psu) return [];

    const gpuSpecs = gpu.specs as GpuSpecs;
    const psuSpecs = psu.specs as PsuSpecs;

    const gpuConn = gpuSpecs.power_connectors;
    const psuConn = psuSpecs.connectors;

    if (!gpuConn) {
      return [
        insufficientData(
          gpu.name,
          "gpu.power_connectors",
          "No se pudieron verificar los conectores de poder de la GPU.",
        ),
      ];
    }
    if (!psuConn) {
      return [
        insufficientData(psu.name, "psu.connectors", "No se pudieron verificar los conectores de poder de la fuente."),
      ];
    }

    const issues: ValidationIssue[] = [];

    const gpuNeeds12vhpwr = gpuConn.pcie_12vhpwr ?? 0;
    const psuHas12vhpwr = psuConn.pcie_12vhpwr ?? 0;

    if (gpuNeeds12vhpwr > 0 && psuHas12vhpwr < gpuNeeds12vhpwr) {
      issues.push({
        code: "MISSING_12VHPWR",
        severity: "error",
        message: `La GPU requiere ${gpuNeeds12vhpwr} conector 12VHPWR pero la PSU tiene ${psuHas12vhpwr}`,
        details: "Necesitas una fuente con conector 12VHPWR (16-pin) o un adaptador certificado.",
        componentA: gpu.name,
        componentB: psu.name,
      });
    }

    const gpuNeeds8 = gpuConn.pcie_8_pin ?? 0;
    const gpuNeeds6 = gpuConn.pcie_6_pin ?? 0;
    // PSU's 6+2 pin se cuenta tanto para 6 como para 8 pin.
    const psuPcie62 = psuConn.pcie_6_plus_2_pin ?? 0;
    const totalPciePsu = psuPcie62;

    const totalNeeded = gpuNeeds8 + gpuNeeds6;
    if (totalNeeded > 0 && totalPciePsu < totalNeeded) {
      issues.push({
        code: "INSUFFICIENT_PCIE_CONNECTORS",
        severity: "warning",
        message: `Conectores PCIe insuficientes: GPU pide ${totalNeeded} (${gpuNeeds8} de 8-pin + ${gpuNeeds6} de 6-pin), PSU tiene ${totalPciePsu} (6+2 pin)`,
        details: "Es posible que necesites adaptadores molex/SATA a PCIe (no recomendado).",
        componentA: gpu.name,
        componentB: psu.name,
      });
    }

    return issues;
  },
};

/**
 * Regla 7: Form factor de la motherboard soportado por el case.
 */
export const MotherboardFormFactorRule: BuildRule = {
  name: "MotherboardFormFactor",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const mobo = parts.motherboard;
    const pcCase = parts.case;
    if (!mobo || !pcCase) return [];

    const moboSpecs = mobo.specs as MotherboardSpecs;
    const caseSpecs = pcCase.specs as CaseSpecs;

    const moboFF = moboSpecs.form_factor;
    const supportedFFs = caseSpecs.supported_motherboard_form_factors;

    if (!moboFF) {
      return [
        insufficientData(
          mobo.name,
          "motherboard.form_factor",
          "No se pudo verificar el form-factor de la placa madre.",
        ),
      ];
    }
    if (!supportedFFs || supportedFFs.length === 0) {
      return [
        insufficientData(
          pcCase.name,
          "case.supported_motherboard_form_factors",
          "No se pudo verificar qué form-factors soporta el gabinete.",
        ),
      ];
    }

    const moboNorm = normalizeFormFactor(moboFF);
    const supported = supportedFFs.map(normalizeFormFactor);

    const matched = supported.some((s) => s === moboNorm || s.includes(moboNorm));

    if (!matched) {
      return [
        {
          code: "MOTHERBOARD_FORM_FACTOR_MISMATCH",
          severity: "error",
          message: `Form factor incompatible: la placa es ${moboFF} pero el gabinete soporta ${supportedFFs.join(", ")}`,
          details: "La motherboard no se podrá montar en este gabinete.",
          componentA: mobo.name,
          componentB: pcCase.name,
        },
      ];
    }

    return [];
  },
};

/**
 * Regla 8: La cantidad de módulos RAM no excede los slots de la mobo.
 *
 * `parts.ram.quantity` representa el número total de módulos en el build.
 */
export const MemorySlotRule: BuildRule = {
  name: "MemorySlots",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const ram = parts.ram;
    const mobo = parts.motherboard;
    if (!ram || !mobo) return [];

    const moboSpecs = mobo.specs as MotherboardSpecs;
    const slots = moboSpecs.memory?.slots;

    if (typeof slots !== "number") {
      return [
        insufficientData(
          mobo.name,
          "motherboard.memory.slots",
          "No se pudo verificar la cantidad de slots de RAM disponibles.",
        ),
      ];
    }

    const ramSpecs = ram.specs as RamSpecs;
    // Total de módulos: si el spec del kit indica modules.quantity, lo
    // multiplicamos por la cantidad de kits comprados.
    const modulesPerKit = ramSpecs.modules?.quantity ?? 1;
    const kits = ram.quantity ?? 1;
    const totalModules = modulesPerKit * kits;

    if (totalModules > slots) {
      return [
        {
          code: "MEMORY_SLOTS_EXCEEDED",
          severity: "error",
          message: `Demasiados módulos de RAM: el build usa ${totalModules} módulos pero la placa tiene ${slots} slots`,
          details: "Reduce la cantidad de kits o usa módulos de mayor capacidad.",
          componentA: ram.name,
          componentB: mobo.name,
        },
      ];
    }

    return [];
  },
};

/**
 * Regla 9: Velocidad de RAM vs velocidad máxima soportada por la mobo (JEDEC).
 *
 * Si excede, emite warning indicando que probablemente requiere XMP/EXPO.
 * Nota: el schema actual de Motherboard no expone `memory.max_speed_mhz` —
 * en ese caso emitimos INSUFFICIENT_DATA.
 */
export const MemorySpeedRule: BuildRule = {
  name: "MemorySpeed",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const ram = parts.ram;
    const mobo = parts.motherboard;
    if (!ram || !mobo) return [];

    const ramSpecs = ram.specs as RamSpecs;
    const moboSpecs = mobo.specs as MotherboardSpecs;

    const ramSpeed = ramSpecs.speed_mt_s;
    // El schema no tiene un campo para la velocidad max de la mobo. Soporte
    // best-effort: si alguien extiende el schema con max_speed_mt_s, lo usamos.
    const moboMemory = moboSpecs.memory as
      | (typeof moboSpecs.memory & { max_speed_mt_s?: number | null })
      | null
      | undefined;
    const moboMaxSpeed = moboMemory?.max_speed_mt_s;

    if (typeof ramSpeed !== "number") {
      return [insufficientData(ram.name, "ram.speed_mt_s", "No se pudo verificar la velocidad de la RAM.")];
    }
    if (typeof moboMaxSpeed !== "number") {
      return [
        insufficientData(
          mobo.name,
          "motherboard.memory.max_speed_mt_s",
          "No se pudo verificar la velocidad máxima de RAM soportada por la placa.",
        ),
      ];
    }

    if (ramSpeed > moboMaxSpeed) {
      return [
        {
          code: "MEMORY_SPEED_REQUIRES_OC",
          severity: "warning",
          message: `RAM más rápida (${ramSpeed} MT/s) que el soporte JEDEC de la placa (${moboMaxSpeed} MT/s)`,
          details: "Probablemente necesitarás habilitar XMP/EXPO en la BIOS para alcanzar la velocidad anunciada.",
          componentA: ram.name,
          componentB: mobo.name,
        },
      ];
    }

    return [];
  },
};

/**
 * Regla 10: Cantidad de SSDs/HDDs no excede los puertos disponibles.
 */
export const StorageInterfaceRule: BuildRule = {
  name: "StorageInterface",

  validate(parts: BuildComponentsMap): ValidationIssue[] {
    const mobo = parts.motherboard;
    if (!mobo) return [];
    const ssd = parts.ssd;
    const hdd = parts.hdd;
    if (!ssd && !hdd) return [];

    const moboSpecs = mobo.specs as MotherboardSpecs;
    const m2Slots = moboSpecs.m2_slots;
    const sataPorts = moboSpecs.sata_ports;

    if (!m2Slots && typeof sataPorts !== "number") {
      return [
        insufficientData(
          mobo.name,
          "motherboard.m2_slots / motherboard.sata_ports",
          "No se pudo verificar los puertos de almacenamiento disponibles.",
        ),
      ];
    }

    const issues: ValidationIssue[] = [];

    // Clasificar SSDs por interfaz
    let nvmeNeeded = 0;
    let sataNeeded = 0;

    const isNvme = (p: BuildProduct): boolean => {
      const s = p.specs as StorageSpecs;
      if (s.nvme === true) return true;
      const iface = (s.interface ?? "").toLowerCase();
      const ff = (s.form_factor ?? "").toLowerCase();
      return iface.includes("nvme") || iface.includes("pcie") || ff.includes("m.2");
    };

    if (ssd) {
      const qty = ssd.quantity ?? 1;
      if (isNvme(ssd)) nvmeNeeded += qty;
      else sataNeeded += qty;
    }
    if (hdd) {
      sataNeeded += hdd.quantity ?? 1;
    }

    const m2Available = m2Slots?.length ?? 0;
    const sataAvailable = sataPorts ?? 0;

    if (nvmeNeeded > m2Available) {
      issues.push({
        code: "STORAGE_INTERFACE_EXCEEDED",
        severity: "error",
        message: `SSDs NVMe exceden los slots M.2 disponibles: ${nvmeNeeded} vs ${m2Available}`,
        details: "Cambia a un SSD SATA o elige una placa con más slots M.2.",
        componentA: ssd?.name ?? mobo.name,
        componentB: mobo.name,
      });
    }

    if (sataNeeded > sataAvailable) {
      issues.push({
        code: "STORAGE_INTERFACE_EXCEEDED",
        severity: "error",
        message: `Unidades SATA exceden los puertos disponibles: ${sataNeeded} vs ${sataAvailable}`,
        details: "Reduce la cantidad de unidades SATA o elige una placa con más puertos.",
        componentA: ssd?.name ?? hdd?.name ?? mobo.name,
        componentB: mobo.name,
      });
    }

    return issues;
  },
};

/**
 * Array con todas las reglas disponibles.
 */
export const ALL_RULES: BuildRule[] = [
  CompletenessRule,
  SocketCompatibilityRule,
  WattageRule,
  MemoryTypeRule,
  GpuClearanceRule,
  CoolerClearanceRule,
  PsuConnectorRule,
  MotherboardFormFactorRule,
  MemorySlotRule,
  MemorySpeedRule,
  StorageInterfaceRule,
];

// Registramos las reglas como las "default" del motor para que `analyzeBuild()`
// (sin argumentos) funcione sin necesidad de pasar la lista.
_registerDefaultRules(ALL_RULES);
