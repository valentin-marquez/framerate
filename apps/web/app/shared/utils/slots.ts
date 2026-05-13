export type SlotType = "exclusive" | "additive";

export interface SlotDefinition {
  id: string;
  label: string;
  shortLabel: string; // For the placeholder icon
  type: SlotType;
  accepts: string[];
}

export const QUOTE_SLOTS: SlotDefinition[] = [
  {
    id: "cpu",
    label: "Procesador",
    shortLabel: "CPU",
    type: "exclusive",
    accepts: ["procesadores"],
  },
  {
    id: "motherboard",
    label: "Placa Madre",
    shortLabel: "MB",
    type: "exclusive",
    accepts: ["placas-madre"],
  },
  {
    id: "ram",
    label: "Memoria RAM",
    shortLabel: "RAM",
    type: "exclusive", // User requested switching between types
    accepts: ["memorias-ram"],
  },
  {
    id: "gpu",
    label: "Tarjeta de Video",
    shortLabel: "GPU",
    type: "exclusive",
    accepts: ["tarjetas-de-video"],
  },
  {
    id: "storage",
    label: "Almacenamiento",
    shortLabel: "SSD/HDD",
    type: "additive",
    accepts: ["ssd", "discos-duros"],
  },
  {
    id: "psu",
    label: "Fuente de Poder",
    shortLabel: "PSU",
    type: "exclusive",
    accepts: ["fuentes-de-poder"],
  },
  {
    id: "case",
    label: "Gabinete",
    shortLabel: "CASE",
    type: "exclusive",
    accepts: ["gabinetes"],
  },
  {
    id: "cpu_cooler",
    label: "Refrigeración CPU",
    shortLabel: "COOLER",
    type: "exclusive",
    accepts: ["coolers-cpu"],
  },
  {
    id: "case_fan",
    label: "Ventilación",
    shortLabel: "FAN",
    type: "additive",
    accepts: ["ventiladores"],
  },
];
