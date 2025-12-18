import type { HddSpecs } from "@framerate/db";

function extractCapacityFromTitle(title: string): string {
  const tbMatch = title.match(/(\d+)\s*TB/i);
  if (tbMatch) {
    return `${tbMatch[1]} TB`;
  }

  const gbMatch = title.match(/(\d+)\s*GB/i);
  if (gbMatch) {
    return `${gbMatch[1]} GB`;
  }

  return "";
}

function extractRpmFromTitle(title: string): string {
  const rpmMatch = title.match(/(\d{4,5})\s*RPM/i);
  if (rpmMatch) {
    return `${rpmMatch[1]} rpm`;
  }

  return "";
}

function extractSizeFromTitle(title: string): string {
  const sizeMatch = title.match(/([23][.,]5)\s*[""]?/i);
  if (sizeMatch) {
    const size = sizeMatch[1].replace(",", ".");
    return `${size}"`;
  }

  const titleUpper = title.toUpperCase();
  if (titleUpper.includes("INTERNO 3.5") || titleUpper.includes("INTERNO 3,5")) {
    return '3.5"';
  }
  if (titleUpper.includes("INTERNO 2.5") || titleUpper.includes("INTERNO 2,5")) {
    return '2.5"';
  }

  return "";
}

function extractBusFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  if (
    titleUpper.includes("SATA 6GB/S") ||
    titleUpper.includes("SATA 6 GB/S") ||
    titleUpper.includes("SATA III") ||
    titleUpper.includes("SATA3") ||
    titleUpper.includes("SATA 3")
  ) {
    return "SATA 3 (6.0 Gb/s)";
  }

  if (titleUpper.includes("SATA")) {
    return "SATA";
  }

  return "";
}

function extractBufferFromTitle(title: string): string {
  const bufferMatch = title.match(/B[ÚU]FER:?\s*(\d+)\s*MB/i);
  if (bufferMatch) {
    return `${bufferMatch[1]} MB`;
  }

  const cacheMatch = title.match(/(\d+)\s*MB\s*CACHE/i);
  if (cacheMatch) {
    return `${cacheMatch[1]} MB`;
  }

  return "";
}

function extractLineFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  if (titleUpper.includes("WD GOLD")) return "WD Gold";
  if (titleUpper.includes("WD BLUE")) return "WD Blue";
  if (titleUpper.includes("WD BLACK")) return "WD Black";
  if (titleUpper.includes("WD RED")) return "WD Red";
  if (titleUpper.includes("WD PURPLE")) return "WD Purple";
  if (titleUpper.includes("WD GREEN")) return "WD Green";

  if (titleUpper.includes("SKYHAWK")) return "Seagate Skyhawk";
  if (titleUpper.includes("BARRACUDA")) return "Seagate Barracuda";
  if (titleUpper.includes("IRONWOLF")) return "Seagate IronWolf";
  if (titleUpper.includes("EXOS")) return "Seagate Exos";
  if (titleUpper.includes("FIRECUDA")) return "Seagate FireCuda";

  if (titleUpper.includes("ULTRASTAR")) return "Hitachi Ultrastar";
  if (titleUpper.includes("DESKSTAR")) return "Hitachi Deskstar";
  if (titleUpper.includes("TRAVELSTAR")) return "Hitachi Travelstar";

  if (titleUpper.includes("P300")) return "Toshiba P300";
  if (titleUpper.includes("X300")) return "Toshiba X300";
  if (titleUpper.includes("N300")) return "Toshiba N300";

  return "";
}

export const HddProcessor = {
  normalize(rawSpecs: Record<string, string>, title = ""): HddSpecs {
    const titleCapacity = extractCapacityFromTitle(title);
    const titleRpm = extractRpmFromTitle(title);
    const titleSize = extractSizeFromTitle(title);
    const titleBus = extractBusFromTitle(title);
    const titleBuffer = extractBufferFromTitle(title);
    const titleLine = extractLineFromTitle(title);

    return {
      manufacturer: rawSpecs.manufacturer || rawSpecs.brand || rawSpecs.fabricante || rawSpecs.marca || "",
      type: rawSpecs.type || rawSpecs.tipo || "HDD",
      line: rawSpecs.line || rawSpecs.linea || rawSpecs.línea || titleLine || "",
      capacity: rawSpecs.capacity || rawSpecs.capacidad || titleCapacity || "",
      rpm: rawSpecs.rpm || titleRpm || "",
      size: rawSpecs.size || rawSpecs.tamano || rawSpecs.tamaño || titleSize || "",
      bus: rawSpecs.bus || titleBus || "",
      buffer: rawSpecs.buffer || rawSpecs.bufer || rawSpecs.búfer || titleBuffer || "",
    };
  },
};
