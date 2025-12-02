/**
 * Procesador de Coolers de CPU
 * Normaliza y extrae especificaciones de disipadores y refrigeración líquida.
 */

import type { CpuCoolerSpecs } from "@framerate/db";

function extractTypeFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  if (
    titleUpper.includes("REFRIGERACION LIQUIDA") ||
    titleUpper.includes("REGRIGERACION LIQUIDA") ||
    titleUpper.includes("REFRIGERACIÓN LÍQUIDA") ||
    titleUpper.includes("WATERCOOLING") ||
    titleUpper.includes("WATER COOLING") ||
    titleUpper.includes("AIO") ||
    titleUpper.includes("LIQUID")
  ) {
    return "Refrigeración líquida";
  }

  if (
    titleUpper.includes("VENTILADOR PARA CPU") ||
    titleUpper.includes("VENTILADOR CPU") ||
    titleUpper.includes("COOLER CPU") ||
    titleUpper.includes("CPU COOLER") ||
    titleUpper.includes("DISIPADOR")
  ) {
    return "Ventilador";
  }

  return "Ventilador";
}

function extractFanSizeFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  const aioMatch = titleUpper.match(/\b(120|140|240|280|360|420)\b/);
  if (aioMatch) {
    const size = aioMatch[1];
    if (
      titleUpper.includes("LIQUIDA") ||
      titleUpper.includes("WATERCOOLING") ||
      titleUpper.includes("AIO")
    ) {
      return `${size} mm`;
    }
  }

  const fanMatch = titleUpper.match(/(\d{2,3})\s*MM/);
  if (fanMatch) {
    return `${fanMatch[1]} mm`;
  }

  return "";
}

function extractIlluminationFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  if (
    titleUpper.includes("ARGB") ||
    titleUpper.includes("A-RGB") ||
    titleUpper.includes("ADDRESSABLE")
  ) {
    return "ARGB";
  }

  if (titleUpper.includes("RGB")) {
    return "RGB";
  }

  if (titleUpper.includes("LED")) {
    return "LED";
  }

  return "No";
}

function extractSocketsFromSpecs(rawSpecs: Record<string, string>): string[] {
  const sockets: string[] = [];
  const socketKeys = ["compatible_sockets", "sockets_compatibles", "sockets", "compatibilidad"];

  for (const key of socketKeys) {
    const value = rawSpecs[key];
    if (value) {
      const parts = value.split(/[,/\n]+/).map((s) => s.trim());
      for (const part of parts) {
        if (part && !sockets.includes(part)) {
          sockets.push(part);
        }
      }
    }
  }

  for (const [key, value] of Object.entries(rawSpecs)) {
    const keyLower = key.toLowerCase();
    if (
      keyLower.includes("am4") ||
      keyLower.includes("am5") ||
      keyLower.includes("lga") ||
      keyLower.includes("socket")
    ) {
      if (
        value.toLowerCase() === "sí" ||
        value.toLowerCase() === "si" ||
        value.toLowerCase() === "yes"
      ) {
        const socketMatch = key.match(
          /(AM\d|LGA\s*\d+|LGA\s*115x|LGA\s*1200|LGA\s*1700|LGA\s*1851)/i,
        );
        if (socketMatch) {
          const socket = socketMatch[1].toUpperCase().replace(/\s+/g, " ");
          if (!sockets.includes(socket)) {
            sockets.push(socket);
          }
        }
      }
    }
  }

  return sockets;
}

function parseSocketString(socketStr: string): string[] {
  const sockets: string[] = [];
  const parts = socketStr.split(/[,/]+/).map((s) => s.trim());

  for (const part of parts) {
    if (part) {
      sockets.push(part);
    }
  }

  return sockets;
}

export function normalizeCpuCooler(
  rawSpecs: Record<string, string>,
  productTitle?: string,
): CpuCoolerSpecs {
  const title = productTitle || "";

  let type = rawSpecs.type || rawSpecs.tipo || "";
  if (!type && title) {
    type = extractTypeFromTitle(title);
  }

  let fanSize = rawSpecs.fan_size || rawSpecs.tamaño_ventilador || rawSpecs.tamano_ventilador || "";
  if (!fanSize && title) {
    fanSize = extractFanSizeFromTitle(title);
  }

  const height = rawSpecs.height || rawSpecs.altura || "";
  const weight = rawSpecs.weight || rawSpecs.peso || "Desconocido";
  const rpm = rawSpecs.rpm || "";

  // Airflow
  const airflow = rawSpecs.airflow || rawSpecs.flujo_de_aire || rawSpecs.flujo_aire || "";

  // Noise level
  const noiseLevel =
    rawSpecs.noise_level || rawSpecs.nivel_de_ruido || rawSpecs.ruido || "Desconocido";

  const heatpipesRaw =
    rawSpecs.has_heatpipes || rawSpecs["¿heatpipes?"] || rawSpecs.heatpipes || "";
  const hasHeatpipes =
    heatpipesRaw.toLowerCase() === "sí" ||
    heatpipesRaw.toLowerCase() === "si" ||
    heatpipesRaw.toLowerCase() === "yes" ||
    heatpipesRaw === "true";

  let illumination = rawSpecs.illumination || rawSpecs.iluminación || rawSpecs.iluminacion || "";
  if (!illumination && title) {
    illumination = extractIlluminationFromTitle(title);
  }

  let compatibleSockets = extractSocketsFromSpecs(rawSpecs);

  if (compatibleSockets.length === 0) {
    const socketsRaw =
      rawSpecs.sockets_compatibles || rawSpecs.compatible_sockets || rawSpecs.sockets || "";
    if (socketsRaw) {
      compatibleSockets = parseSocketString(socketsRaw);
    }
  }

  return {
    manufacturer: rawSpecs.manufacturer || "",
    type,
    fan_size: fanSize,
    height,
    weight,
    rpm,
    airflow,
    noise_level: noiseLevel,
    has_heatpipes: hasHeatpipes,
    illumination,
    compatible_sockets: compatibleSockets,
  };
}

export const CpuCoolerProcessor = {
  normalize: normalizeCpuCooler,
};
