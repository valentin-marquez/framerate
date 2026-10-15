import type { Category } from "./category-list";

/**
 * Filtros por especificación ("facetas"). Salen de `products.attributes`, lo que el matching extrae del título:
 * la misma fuente para servidor (filtra con `json_extract`) y web (chips y etiquetas). Cuando haya
 * especificaciones completas se suman aquí sin cambiar el contrato.
 *
 * Un producto sin el dato de una faceta filtrada no se descarta: va al final de los resultados como "desconocido"
 * (podría cumplir), después de los que cumplen. Sólo se excluyen los que tienen el dato y no cumplen.
 */
export interface FacetDefinition {
  /** Clave en `products.attributes`, o en las specs de sus ofertas (`listing_identity.specs`) con `source: "specs"`. */
  key: string;
  /** Specs que Haiku leyó en el texto de la ficha (#153): filtran sólo las de origen `text`, nunca `knowledge`. */
  source?: "specs";
  label: string;
  /** Sufijo de unidad para valores numéricos ("GB", "MT/s", "W"). */
  unit?: string;
  /** Etiquetas de valores categóricos; los que no estén se muestran tal cual. */
  values?: Record<string, string>;
}

const MEMORY_TYPES = { ddr3: "DDR3", ddr4: "DDR4", ddr5: "DDR5" };
const COLORS = { black: "Negro", white: "Blanco", gray: "Gris", pink: "Rosado", red: "Rojo", beige: "Beige" };
const YES_NO = (yes: string, no: string) => ({ true: yes, false: no });

export const CATEGORY_FACETS: Record<Category, FacetDefinition[]> = {
  gpu: [
    { key: "chipMaker", label: "Fabricante del chip", values: { nvidia: "NVIDIA", amd: "AMD", intel: "Intel" } },
    { key: "chipset", label: "Modelo" },
    { key: "vram", label: "Memoria", unit: "GB" },
    { key: "memory_type", label: "Tipo de memoria", source: "specs" },
    { key: "memory_bus_bit", label: "Bus de memoria", unit: "bits", source: "specs" },
  ],
  cpu: [
    { key: "model", label: "Modelo" },
    { key: "socket", label: "Socket", source: "specs" },
    { key: "cores_total", label: "Núcleos", unit: "núcleos", source: "specs" },
    {
      key: "includes_cooler",
      label: "Disipador",
      values: YES_NO("Con disipador", "Sin disipador"),
      source: "specs",
    },
  ],
  motherboard: [
    { key: "socket", label: "Socket", source: "specs" },
    { key: "chipset", label: "Chipset" },
    { key: "formFactor", label: "Formato", values: { eatx: "E-ATX", atx: "ATX", matx: "Micro ATX", itx: "Mini ITX" } },
    { key: "memory", label: "Memoria", values: MEMORY_TYPES },
    { key: "wifi", label: "Wi-Fi", values: YES_NO("Con Wi-Fi", "Sin Wi-Fi") },
    { key: "m2_slots", label: "Ranuras M.2", unit: "M.2", source: "specs" },
    { key: "memory_slots", label: "Ranuras de memoria", unit: "ranuras", source: "specs" },
  ],
  ram: [
    { key: "type", label: "Tipo", values: MEMORY_TYPES },
    { key: "capacity", label: "Capacidad", unit: "GB" },
    { key: "speed", label: "Velocidad", unit: "MT/s" },
    { key: "modules", label: "Módulos", values: { "1": "1 módulo", "2": "Kit de 2", "4": "Kit de 4" } },
    { key: "formFactor", label: "Formato", values: { dimm: "PC (DIMM)", sodimm: "Notebook (SO-DIMM)" } },
    { key: "casLatency", label: "Latencia", unit: "CL" },
    { key: "rgb", label: "Iluminación", values: YES_NO("Con RGB", "Sin RGB") },
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
    { key: "modular", label: "Cables", values: { full: "Modular", semi: "Semimodular", none: "Fijos" } },
    { key: "formFactor", label: "Formato", values: { atx: "ATX", sfx: "SFX" } },
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
  cpu_cooler: [
    { key: "type", label: "Tipo", values: { air: "Por aire", aio: "Refrigeración líquida" } },
    { key: "radiatorMm", label: "Radiador", unit: "mm" },
  ],
  case: [
    {
      key: "formFactor",
      label: "Formato",
      values: {
        "full tower": "Full tower",
        "mid tower": "Mid tower",
        "mini tower": "Mini tower",
        eatx: "E-ATX",
        atx: "ATX",
        matx: "Micro ATX",
        itx: "Mini ITX",
      },
    },
    { key: "color", label: "Color", values: COLORS },
  ],
  case_fan: [
    { key: "sizeMm", label: "Tamaño", unit: "mm" },
    {
      key: "quantity",
      label: "Cantidad",
      values: { "1": "1 ventilador", "2": "Pack de 2", "3": "Pack de 3", "4": "Pack de 4" },
    },
  ],
};

/**
 * Familia de un producto (#101): los atributos que un comprador compara como "el mismo producto en otra versión",
 * sin importar marca ni línea (una RTX 5070 de ASUS y una de MSI; una DDR5 de 32 GB 2x16 a 6000 de cualquier marca).
 * Son claves de `products.attributes`; el matching calcula `products.family_key` con ellas y la ficha arma el título
 * y el filtro de la categoría. Sin familia: CPU (cada modelo es único), gabinetes y ventiladores (demasiado amplio).
 */
export const FAMILY_FIELDS: Partial<Record<Category, readonly string[]>> = {
  gpu: ["chipset", "vram"],
  motherboard: ["chipset", "formFactor"],
  ram: ["type", "capacity", "modules", "speed", "formFactor"],
  ssd: ["capacity", "interface", "pcieGen"],
  hdd: ["capacity", "rpm", "formFactor"],
  psu: ["wattage", "efficiency"],
  cpu_cooler: ["type", "radiatorMm"],
};

/** Etiqueta visible de un valor: "12 GB", "DDR5", "1 TB" (las capacidades de 1000 GB o más pasan a TB). */
export function facetValueLabel(facet: FacetDefinition, value: string): string {
  const named = facet.values?.[value];
  if (named) return named;
  if (facet.unit === "GB") {
    const gb = Number(value);
    if (Number.isFinite(gb) && gb >= 1000) return `${(gb / 1000).toLocaleString("es-CL")} TB`;
  }
  if (facet.unit === "CL") return `CL${value}`;
  return facet.unit ? `${value} ${facet.unit}` : value.toUpperCase();
}

export function facetsFor(category: Category): FacetDefinition[] {
  return CATEGORY_FACETS[category];
}

/** Forma de `spec=<clave>:<valor>`; la web la valida sin zod. */
export const SPEC_FILTER_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,31}:[^:]{1,60}$/;
