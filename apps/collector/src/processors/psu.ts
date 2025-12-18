/**
 * Procesador de Fuentes de Poder (PSU)
 * Normaliza y extrae especificaciones de fuentes de poder desde diferentes fuentes.
 */

import type { PsuSpecs } from "@framerate/db";
import { extractCertification, extractFormFactor, extractModular, extractWattage } from "./normalizers/psu";

function parsePfcActive(value?: string): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();

  return (
    normalized === "sí" ||
    normalized === "si" ||
    normalized === "yes" ||
    normalized === "true" ||
    normalized === "activo" ||
    normalized === "activa" ||
    normalized.includes("pfc activ")
  );
}

function parseModular(value?: string): string {
  if (!value) return "";
  const normalized = value.toLowerCase().trim();

  if (
    normalized.includes("full") ||
    normalized.includes("fully") ||
    normalized === "sí" ||
    normalized === "si" ||
    normalized === "modular"
  ) {
    return "Full Modular";
  }

  if (normalized.includes("semi")) {
    return "Semi Modular";
  }

  if (normalized === "no" || normalized === "false" || normalized === "") {
    return "No";
  }

  return value;
}

function parseConnectors(value?: string): string[] {
  if (!value) return [];

  const connectors = value
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  return connectors;
}

function extractPfcFromName(name: string): boolean {
  const normalized = name.toUpperCase();
  return normalized.includes("PFC ACTIV") || normalized.includes("PFC ACTIVA") || normalized.includes("ACTIVE PFC");
}

export const PsuProcessor = {
  normalize(rawSpecs: Record<string, string>, productName?: string): PsuSpecs {
    const name = productName || rawSpecs._productName || "";

    let wattage =
      rawSpecs.wattage || rawSpecs.potencia || rawSpecs.potencia_de_salida || rawSpecs["potencia de salida"] || "";

    if (!wattage && name) {
      wattage = extractWattage(name) || "";
    }

    if (wattage && !wattage.toLowerCase().includes("w")) {
      wattage = `${wattage}W`;
    }

    let certification = rawSpecs.certification || rawSpecs.certificación || rawSpecs.certificacion || "";

    if (!certification && name) {
      certification = extractCertification(name) || "";
    }

    let formFactor =
      rawSpecs.form_factor ||
      rawSpecs.factor_de_forma ||
      rawSpecs["factor de forma"] ||
      rawSpecs.tamaño ||
      rawSpecs.tamano ||
      "";

    if (!formFactor && name) {
      formFactor = extractFormFactor(name) || "";
    }

    const pfcRaw =
      rawSpecs.pfc_active || rawSpecs.pfc || rawSpecs.pfc_activo || rawSpecs.tecnología || rawSpecs.tecnologia || "";

    let pfcActive = parsePfcActive(pfcRaw);
    if (!pfcActive && name) {
      pfcActive = extractPfcFromName(name);
    }

    const modularRaw = rawSpecs.modular || rawSpecs.modularidad || "";
    let modular = parseModular(modularRaw);

    if (!modular && name) {
      modular = extractModular(name) || "";
    }

    const rail12v = rawSpecs.rail_12v || rawSpecs.corriente_en_la_línea_de_12_v || rawSpecs.corriente_12v || "";

    const rail5v = rawSpecs.rail_5v || rawSpecs.corriente_en_la_línea_de_5_v || rawSpecs.corriente_5v || "";

    const rail3v3 = rawSpecs.rail_3v3 || rawSpecs["corriente_en_la_línea_de_3.3_v"] || rawSpecs["corriente_3.3v"] || "";

    const connectorsRaw =
      rawSpecs.power_connectors ||
      rawSpecs.conectores ||
      rawSpecs.conectores_de_energía ||
      rawSpecs["conectores de energía"] ||
      rawSpecs.conectores_de_poder ||
      "";

    return {
      manufacturer: rawSpecs.manufacturer || rawSpecs.fabricante || rawSpecs.marca || "",
      wattage,
      certification,
      form_factor: formFactor,
      pfc_active: pfcActive,
      modular,
      rail_12v: rail12v,
      rail_5v: rail5v,
      rail_3v3: rail3v3,
      power_connectors: parseConnectors(connectorsRaw),
    };
  },
};
