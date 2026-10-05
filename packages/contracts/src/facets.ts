import { z } from "zod";
import type { Category } from "./categories";

/**
 * Filtros por especificación ("facetas"). Salen de `products.attributes`, lo que el matching extrae del título:
 * la misma fuente para servidor (filtra con `json_extract`) y web (chips y etiquetas). Cuando haya
 * especificaciones completas se suman aquí sin cambiar el contrato.
 *
 * Un producto sin el dato de una faceta filtrada no se descarta: va al final de los resultados como "desconocido"
 * (podría cumplir), después de los que cumplen. Sólo se excluyen los que tienen el dato y no cumplen.
 */
export interface FacetDefinition {
  /** Clave en `products.attributes`. */
  key: string;
  label: string;
  /** Sufijo de unidad para valores numéricos ("GB", "MT/s", "W"). */
  unit?: string;
  /** Etiquetas de valores categóricos; los que no estén se muestran tal cual. */
  values?: Record<string, string>;
}

const MEMORY_TYPES = { ddr3: "DDR3", ddr4: "DDR4", ddr5: "DDR5" };

export const CATEGORY_FACETS: Record<Category, FacetDefinition[]> = {
  gpu: [
    { key: "vram", label: "Memoria", unit: "GB" },
    { key: "chipset", label: "Modelo" },
  ],
  cpu: [{ key: "model", label: "Modelo" }],
  motherboard: [
    { key: "chipset", label: "Chipset" },
    { key: "formFactor", label: "Formato", values: { eatx: "E-ATX", atx: "ATX", matx: "Micro ATX", itx: "Mini ITX" } },
    { key: "memory", label: "Memoria", values: MEMORY_TYPES },
    { key: "wifi", label: "Wi-Fi", values: { true: "Con Wi-Fi", false: "Sin Wi-Fi" } },
  ],
  ram: [
    { key: "type", label: "Tipo", values: MEMORY_TYPES },
    { key: "capacity", label: "Capacidad", unit: "GB" },
    { key: "speed", label: "Velocidad", unit: "MT/s" },
    { key: "modules", label: "Módulos", values: { "1": "1 módulo", "2": "Kit de 2", "4": "Kit de 4" } },
    { key: "formFactor", label: "Formato", values: { dimm: "PC (DIMM)", sodimm: "Notebook (SO-DIMM)" } },
  ],
  psu: [
    { key: "wattage", label: "Potencia", unit: "W" },
    {
      key: "efficiency",
      label: "Certificación",
      values: {
        white: "80 Plus",
        bronze: "80 Plus Bronze",
        silver: "80 Plus Silver",
        gold: "80 Plus Gold",
        platinum: "80 Plus Platinum",
        titanium: "80 Plus Titanium",
      },
    },
  ],
  ssd: [
    { key: "capacity", label: "Capacidad", unit: "GB" },
    { key: "interface", label: "Interfaz", values: { nvme: "NVMe", sata: "SATA" } },
    { key: "formFactor", label: "Formato", values: { "2.5": '2,5"', "2230": "M.2 2230", "2280": "M.2 2280" } },
    { key: "pcieGen", label: "PCIe", values: { "3": "PCIe 3.0", "4": "PCIe 4.0", "5": "PCIe 5.0" } },
  ],
  hdd: [
    { key: "capacity", label: "Capacidad", unit: "GB" },
    { key: "rpm", label: "Velocidad", unit: "RPM" },
    { key: "formFactor", label: "Formato", values: { "2.5": '2,5"', "3.5": '3,5"' } },
  ],
  cpu_cooler: [],
  case: [],
  case_fan: [],
};

/** Etiqueta visible de un valor: "12 GB", "DDR5", "1 TB" (las capacidades de 1000 GB o más pasan a TB). */
export function facetValueLabel(facet: FacetDefinition, value: string): string {
  const named = facet.values?.[value];
  if (named) return named;
  if (facet.unit === "GB") {
    const gb = Number(value);
    if (Number.isFinite(gb) && gb >= 1000) return `${(gb / 1000).toLocaleString("es-CL")} TB`;
  }
  return facet.unit ? `${value} ${facet.unit}` : value.toUpperCase();
}

export function facetsFor(category: Category): FacetDefinition[] {
  return CATEGORY_FACETS[category];
}

/**
 * Filtro en la URL y en la API: `spec=<clave>:<valor>`, repetible. Varios valores de una clave son OR; claves
 * distintas, AND. Ej.: `?spec=vram:12&spec=vram:16&spec=chipset:rtx 5070`.
 */
export const SpecFilterSchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9]{0,31}:[^:]{1,60}$/)
  .transform((raw) => {
    const at = raw.indexOf(":");
    return { key: raw.slice(0, at), value: raw.slice(at + 1) };
  });
export type SpecFilter = z.output<typeof SpecFilterSchema>;

export const FacetValueSchema = z.object({
  value: z.string(),
  label: z.string(),
  /** Productos con stock con este valor (con los demás filtros de la consulta aplicados, sin el de esta faceta). */
  count: z.number().int().nonnegative(),
});
export type FacetValue = z.infer<typeof FacetValueSchema>;

export const FacetSchema = z.object({
  key: z.string(),
  label: z.string(),
  values: z.array(FacetValueSchema),
  /** Productos con stock sin este dato: aparecen al final si se filtra por la faceta. */
  unknownCount: z.number().int().nonnegative(),
});
export type Facet = z.infer<typeof FacetSchema>;

export const FacetListSchema = z.object({ items: z.array(FacetSchema) });
export type FacetList = z.infer<typeof FacetListSchema>;
