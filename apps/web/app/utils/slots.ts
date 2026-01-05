import type { Category } from "@framerate/db/src/types";

export type SlotType = "exclusive" | "additive";

export interface SlotDefinition {
  id: Category | "storage"; // Merging hdd/ssd into storage for display? Or keep separate? User said "slots pre establecidos". Usually "Storage" is a slot.
  label: string;
  shortLabel: string; // For the placeholder icon
  type: SlotType;
  accepts: Category[];
}

export const QUOTE_SLOTS: SlotDefinition[] = [
  {
    id: "cpu",
    label: "Procesador",
    shortLabel: "CPU",
    type: "exclusive",
    accepts: ["cpu"],
  },
  {
    id: "motherboard",
    label: "Placa Madre",
    shortLabel: "MB",
    type: "exclusive",
    accepts: ["motherboard"],
  },
  {
    id: "ram",
    label: "Memoria RAM",
    shortLabel: "RAM",
    type: "exclusive", // User requested switching between types
    accepts: ["ram"],
  },
  {
    id: "gpu",
    label: "Tarjeta de Video",
    shortLabel: "GPU",
    type: "exclusive",
    accepts: ["gpu"],
  },
  {
    id: "storage",
    label: "Almacenamiento",
    shortLabel: "SSD/HDD",
    type: "additive",
    accepts: ["ssd", "hdd"],
  },
  {
    id: "psu",
    label: "Fuente de Poder",
    shortLabel: "PSU",
    type: "exclusive",
    accepts: ["psu"],
  },
  {
    id: "case",
    label: "Gabinete",
    shortLabel: "CASE",
    type: "exclusive",
    accepts: ["case"],
  },
  {
    id: "cpu_cooler",
    label: "Refrigeración CPU",
    shortLabel: "COOLER",
    type: "exclusive",
    accepts: ["cpu_cooler"],
  },
  {
    id: "case_fan",
    label: "Ventilación",
    shortLabel: "FAN",
    type: "additive",
    accepts: ["case_fan"],
  },
];
