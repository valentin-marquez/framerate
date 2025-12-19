import type { RamSpecs } from "@framerate/db";
import { RamSchema } from "@framerate/db";

function parseBoolean(value?: string): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();

  return normalized === "sí" || normalized === "si" || normalized === "yes" || normalized === "true";
}

function extractTypeFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  if (titleUpper.includes("DDR5")) return "DDR5";
  if (titleUpper.includes("DDR4")) return "DDR4";
  if (titleUpper.includes("DDR3")) return "DDR3";

  return "";
}

function extractCapacityFromTitle(title: string): string {
  const kitMatch = title.match(/(\d+)\s*x\s*(\d+)\s*GB/i);
  if (kitMatch) {
    return `${kitMatch[1]} x ${kitMatch[2]} GB`;
  }

  const singleMatch = title.match(/(\d+)\s*GB/i);
  if (singleMatch) {
    return `1 x ${singleMatch[1]} GB`;
  }

  return "";
}

function extractSpeedFromTitle(title: string): string {
  const ddrMatch = title.match(/DDR[45]-(\d+)/i);
  if (ddrMatch) {
    return `${ddrMatch[1]} MT/s`;
  }

  const mhzMatch = title.match(/(\d{3,5})\s*MHz/i);
  if (mhzMatch) {
    return `${mhzMatch[1]} MT/s`;
  }

  const mtsMatch = title.match(/(\d{3,5})\s*MT\/s/i);
  if (mtsMatch) {
    return `${mtsMatch[1]} MT/s`;
  }

  return "";
}

function extractFormatFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  if (
    titleUpper.includes("SO-DIMM") ||
    titleUpper.includes("SODIMM") ||
    titleUpper.includes("LAPTOP") ||
    titleUpper.includes("NOTEBOOK")
  ) {
    return "SO-DIMM";
  }

  if (titleUpper.includes("DIMM") || titleUpper.includes("DESKTOP")) {
    return "DIMM";
  }

  return "";
}

export const RamProcessor = {
  normalize(rawSpecs: Record<string, string>, title = ""): RamSpecs {
    const titleType = extractTypeFromTitle(title);
    const titleCapacity = extractCapacityFromTitle(title);
    const titleSpeed = extractSpeedFromTitle(title);
    const titleFormat = extractFormatFromTitle(title);

    const normalized: RamSpecs = {
      manufacturer: rawSpecs.manufacturer || rawSpecs.fabricante || rawSpecs.marca || "",
      capacity: rawSpecs.capacity || rawSpecs.capacidad || titleCapacity || "",
      type: rawSpecs.type || rawSpecs.tipo || titleType || "",
      speed: rawSpecs.speed || rawSpecs.velocidad || titleSpeed || "",
      format: rawSpecs.format || rawSpecs.formato || titleFormat || "",
      voltage: rawSpecs.voltage || rawSpecs.voltaje || "",
      latency_cl:
        rawSpecs.latency_cl || rawSpecs.latencia_cl || rawSpecs["latencia cl (cas)"] || rawSpecs.latencia_cl_cas || "",
      latency_trcd: rawSpecs.latency_trcd || rawSpecs.latencia_trcd || rawSpecs["latencia trcd"] || "",
      latency_trp: rawSpecs.latency_trp || rawSpecs.latencia_trp || rawSpecs["latencia trp"] || "",
      latency_tras: rawSpecs.latency_tras || rawSpecs.latencia_tras || rawSpecs["latencia tras"] || "",
      ecc_support: parseBoolean(rawSpecs.ecc_support || rawSpecs.soporte_ecc || rawSpecs["soporte ecc"] || ""),
      full_buffered: parseBoolean(
        rawSpecs.full_buffered || rawSpecs.soporte_full_buffered || rawSpecs["soporte full buffered"] || "",
      ),
    };

    // Validate & clean with Zod schema. This will throw if invalid — desirable to catch normalization issues early.
    return RamSchema.parse(normalized);
  },
};
