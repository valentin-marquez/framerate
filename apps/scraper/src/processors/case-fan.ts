import type { CaseFanSpecs } from "@framerate/db";

function extractSizeFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  const mmMatch = titleUpper.match(/(\d{2,3})\s*MM/);
  if (mmMatch) {
    return `${mmMatch[1]} mm`;
  }

  const cmMatch = titleUpper.match(/(\d{1,2})\s*CM/);
  if (cmMatch) {
    const cm = Number.parseInt(cmMatch[1], 10);
    return `${cm * 10} mm`;
  }

  const squareMatch = titleUpper.match(/(\d{2})\s*X\s*\d{2}/);
  if (squareMatch) {
    const cm = Number.parseInt(squareMatch[1], 10);
    return `${cm * 10} mm`;
  }

  return "";
}

function extractIlluminationFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  if (
    titleUpper.includes("ARGB") ||
    titleUpper.includes("A-RGB") ||
    titleUpper.includes("ADDRESSABLE RGB")
  ) {
    return "ARGB";
  }

  if (titleUpper.includes("RGB") || titleUpper.includes("RAINBOW")) {
    return "RGB";
  }

  if (titleUpper.includes("LED")) {
    return "LED";
  }

  if (titleUpper.includes("HALO")) {
    return "ARGB";
  }

  if (titleUpper.includes("PRISMATIC")) {
    return "ARGB";
  }

  return "No";
}

function extractFanCountFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  const kitMatch = titleUpper.match(/(?:KIT|PACK)\s*(?:DE|X|)\s*(\d+)/);
  if (kitMatch) {
    return kitMatch[1];
  }

  const ventMatch = titleUpper.match(/(\d+)\s*VENTILADOR(?:ES)?/);
  if (ventMatch && Number.parseInt(ventMatch[1], 10) > 1) {
    return ventMatch[1];
  }

  return "1";
}

function extractRpmFromTitle(title: string): string {
  const rpmMatch = title.match(/(\d{3,4}(?:\s*-\s*\d{3,4})?)\s*RPM/i);
  if (rpmMatch) {
    return `${rpmMatch[1].replace(/\s/g, "")} RPM`;
  }

  return "";
}

export function normalizeCaseFan(
  rawSpecs: Record<string, string>,
  productTitle?: string,
): CaseFanSpecs {
  const title = productTitle || "";

  const powerConnectors: string[] = [];
  const powerRaw =
    rawSpecs.power_connectors || rawSpecs.conexiones_de_poder || rawSpecs.conectores || "";
  if (powerRaw) {
    const connectors = powerRaw.split(/[,\n]+/).map((c) => c.trim());
    for (const conn of connectors) {
      if (conn) powerConnectors.push(conn);
    }
  }

  let size = rawSpecs.size || rawSpecs.tamaño || rawSpecs.tamano || "";
  if (!size && title) {
    size = extractSizeFromTitle(title);
  }

  let illumination = rawSpecs.illumination || rawSpecs.iluminación || rawSpecs.iluminacion || "";
  if (illumination.toLowerCase() === "no" || illumination.toLowerCase() === "sin iluminación") {
    illumination = "No";
  } else if (!illumination && title) {
    illumination = extractIlluminationFromTitle(title);
  }

  let fansIncluded =
    rawSpecs.fans_included ||
    rawSpecs.included_fans ||
    rawSpecs.ventiladores_incluidos ||
    rawSpecs.cantidad ||
    "";
  if (!fansIncluded && title) {
    fansIncluded = extractFanCountFromTitle(title);
  }

  let rpm = rawSpecs.rpm || "";
  if (!rpm && title) {
    rpm = extractRpmFromTitle(title);
  }

  const hubRaw = rawSpecs.includes_hub || rawSpecs["¿incluye_hub?"] || rawSpecs.incluye_hub || "";
  const includesHub =
    hubRaw.toLowerCase() === "sí" ||
    hubRaw.toLowerCase() === "si" ||
    hubRaw.toLowerCase() === "yes" ||
    hubRaw === "true";

  const bearing = rawSpecs.bearing || rawSpecs.rodamiento || rawSpecs.tipo_rodamiento || "";

  const airflow = rawSpecs.airflow || rawSpecs.flujo_de_aire || rawSpecs.flujo_aire || "";

  const staticPressure =
    rawSpecs.static_pressure || rawSpecs.presión_estática || rawSpecs.presion_estatica || "";

  const noiseLevel = rawSpecs.noise_level || rawSpecs.nivel_de_ruido || rawSpecs.ruido || "";

  let lightingControl =
    rawSpecs.lighting_control ||
    rawSpecs.control_de_iluminación ||
    rawSpecs.control_iluminacion ||
    "";
  if (lightingControl.toLowerCase() === "no posee" || lightingControl.toLowerCase() === "no") {
    lightingControl = "No posee";
  }

  return {
    manufacturer: rawSpecs.manufacturer || "",
    size,
    rpm,
    airflow,
    static_pressure: staticPressure,
    noise_level: noiseLevel || "Desconocido",
    illumination,
    lighting_control: lightingControl,
    bearing,
    fans_included: fansIncluded || "1",
    includes_hub: includesHub,
    power_connectors: powerConnectors,
  };
}

export const CaseFanProcessor = {
  normalize: normalizeCaseFan,
};
