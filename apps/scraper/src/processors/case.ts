/**
 * Procesador de Gabinetes (Case)
 * Normaliza y extrae especificaciones de gabinetes desde diferentes fuentes.
 */

import type { CaseSpecs } from "@framerate/db";
import { CaseNormalizer } from "./normalizers/case";

function parseList(value?: string): string[] {
  if (!value) return [];

  const items = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !item.startsWith("<"));

  return items;
}

function extractSidePanelFromTitle(title: string): string {
  const titleUpper = title.toUpperCase();

  if (
    titleUpper.includes("VIDRIO TEMPLADO") ||
    titleUpper.includes("TEMPERED GLASS") ||
    titleUpper.includes("TG")
  ) {
    return "Vidrio templado";
  }
  if (titleUpper.includes("ACRILICO") || titleUpper.includes("ACRYLIC")) {
    return "Acrílico";
  }

  return "";
}

export const CaseProcessor = {
  normalize(rawSpecs: Record<string, string>, title = ""): CaseSpecs {
    const titleFormFactor = CaseNormalizer.extractFormFactor(title) || "";
    const titleColor = CaseNormalizer.extractColor(title) || "";
    const features = CaseNormalizer.extractFeatures(title);
    const titleIllumination = features.rgb || "";
    const titleSidePanel = extractSidePanelFromTitle(title);

    return {
      manufacturer: rawSpecs.manufacturer || rawSpecs.fabricante || rawSpecs.marca || "",
      max_motherboard_size:
        rawSpecs.max_motherboard_size ||
        rawSpecs.tamano_maximo_de_placa_madre ||
        rawSpecs["tamaño máximo de placa madre"] ||
        titleFormFactor ||
        "",
      psu_included:
        rawSpecs.psu_included || rawSpecs.fuente_de_poder || rawSpecs["fuente de poder"] || "",
      side_panel:
        rawSpecs.side_panel ||
        rawSpecs.panel_lateral ||
        rawSpecs["panel lateral"] ||
        titleSidePanel ||
        "",
      color: rawSpecs.color || titleColor || "",
      illumination:
        rawSpecs.illumination ||
        rawSpecs.iluminacion ||
        rawSpecs.iluminación ||
        titleIllumination ||
        "",
      dimensions:
        rawSpecs.dimensions || rawSpecs.tamano || rawSpecs.tamaño || rawSpecs.dimensiones || "",
      max_gpu_length:
        rawSpecs.max_gpu_length ||
        rawSpecs.largo_maximo_de_tarjeta_de_video ||
        rawSpecs["largo máximo de tarjeta de video"] ||
        "",
      max_cooler_height:
        rawSpecs.max_cooler_height ||
        rawSpecs.alto_maximo_de_cooler ||
        rawSpecs["alto máximo de cooler"] ||
        "",
      weight: rawSpecs.weight || rawSpecs.peso || "",
      psu_position:
        rawSpecs.psu_position ||
        rawSpecs.ubicacion_de_la_psu ||
        rawSpecs["ubicación de la psu"] ||
        "",
      expansion_slots:
        rawSpecs.expansion_slots ||
        rawSpecs.slots_de_expansion ||
        rawSpecs["slots de expansión"] ||
        "",
      front_ports: parseList(rawSpecs.front_ports || rawSpecs.puertos || ""),
      drive_bays: parseList(rawSpecs.drive_bays || rawSpecs.bahias || rawSpecs.bahías || ""),
      front_fans:
        rawSpecs.front_fans ||
        rawSpecs.espacios_para_vent_frontales ||
        rawSpecs["espacios para vent. frontales"] ||
        "",
      rear_fans:
        rawSpecs.rear_fans ||
        rawSpecs.espacios_para_vent_traseros ||
        rawSpecs["espacios para vent. traseros"] ||
        "",
      side_fans:
        rawSpecs.side_fans ||
        rawSpecs.espacios_para_vent_laterales ||
        rawSpecs["espacios para vent. laterales"] ||
        "",
      top_fans:
        rawSpecs.top_fans ||
        rawSpecs.espacios_para_vent_superiores ||
        rawSpecs["espacios para vent. superiores"] ||
        "",
      bottom_fans:
        rawSpecs.bottom_fans ||
        rawSpecs.espacios_para_vent_inferiores ||
        rawSpecs["espacios para vent. inferiores"] ||
        "",
      included_fans:
        rawSpecs.included_fans ||
        rawSpecs.ventiladores_incluidos ||
        rawSpecs["ventiladores incluidos"] ||
        "",
    };
  },
};
