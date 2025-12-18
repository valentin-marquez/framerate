import type { MotherboardSpecs } from "@framerate/db";

function parseBoolean(value?: string): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();

  return normalized === "sí" || normalized === "si" || normalized === "yes" || normalized === "true";
}

function parseList(value?: string): string[] {
  if (!value) return [];

  const items = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !item.startsWith("<"));

  return items;
}

export const MotherboardProcessor = {
  normalize(rawSpecs: Record<string, string>): MotherboardSpecs {
    return {
      manufacturer: rawSpecs.manufacturer || rawSpecs.fabricante || rawSpecs.marca || "",
      socket: rawSpecs.socket || "",
      chipset: rawSpecs.chipset || "",
      memory_slots: rawSpecs.memory_slots || rawSpecs.slots_memorias || rawSpecs["slots memorias"] || "",
      memory_channels: rawSpecs.memory_channels || rawSpecs.canales_memoria || rawSpecs["canales memoria"] || "",
      form_factor: rawSpecs.form_factor || rawSpecs.formato || "",
      rgb_support: parseList(rawSpecs.rgb_support || rawSpecs.soporte_rgb || rawSpecs["soporte rgb"] || ""),
      video_ports: parseList(rawSpecs.video_ports || rawSpecs.puertos_de_video || rawSpecs["puertos de video"] || ""),
      power_connectors: parseList(
        rawSpecs.power_connectors ||
          rawSpecs.puertos_de_energía ||
          rawSpecs["puertos de energía"] ||
          rawSpecs.puertos_de_energia ||
          "",
      ),
      integrated_graphics:
        rawSpecs.integrated_graphics ||
        rawSpecs.gráficos_integrados ||
        rawSpecs["gráficos integrados"] ||
        rawSpecs.graficos_integrados ||
        "",
      sli_support: parseBoolean(rawSpecs.sli_support || rawSpecs.soporte_sli || rawSpecs["soporte sli"] || ""),
      crossfire_support: parseBoolean(
        rawSpecs.crossfire_support || rawSpecs.soporte_crossfire || rawSpecs["soporte crossfire"] || "",
      ),
      raid_support: parseBoolean(rawSpecs.raid_support || rawSpecs.soporte_raid || rawSpecs["soporte raid"] || ""),
      storage_connectors: parseList(rawSpecs.storage_connectors || rawSpecs.conectores || ""),
      io_ports: parseList(rawSpecs.io_ports || rawSpecs.puertos || ""),
      expansion_slots: parseList(rawSpecs.expansion_slots || rawSpecs.expansiones || ""),
    };
  },
};
