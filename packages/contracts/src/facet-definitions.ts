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
  /** Sólo `values` son opciones: lo demás que haya guardado (texto libre de antes de los enums) no se ofrece. */
  closed?: boolean;
  /** Orden fijo de las opciones (por defecto, de más a menos productos): una escala como el formato de un teclado. */
  order?: readonly string[];
  /**
   * Umbral en vez de valor exacto: se elige un solo valor y cumple ese valor o más (`min`) o ese valor o menos (`max`).
   * Con `values`, el orden de sus claves (de menor a mayor) es el de la escala (la certificación 80 Plus).
   */
  threshold?: "min" | "max";
  /** Con umbral numérico: las opciones son estos escalones y no cada valor medido (hay 158 largos de GPU distintos). */
  steps?: readonly number[];
  /** Valores guardados que valen por varias opciones: cuentan en cada una y los trae cualquiera de ellas. */
  combined?: Record<string, readonly string[]>;
}

const MEMORY_TYPES = { ddr3: "DDR3", ddr4: "DDR4", ddr5: "DDR5" };
const COLORS = { black: "Negro", white: "Blanco", gray: "Gris", pink: "Rosado", red: "Rojo", beige: "Beige" };
const YES_NO = (yes: string, no: string) => ({ true: yes, false: no });
// `connection` de teclados y mouses, como llega limpio de las specs (mayúsculas). El que tiene ambas sale en las dos.
const CONNECTION: Pick<FacetDefinition, "key" | "label" | "values" | "combined" | "source"> = {
  key: "connection",
  label: "Tipo de conexión",
  values: { WIRED: "Con cable", "2.4GHZ": "2,4 GHz", BLUETOOTH: "Bluetooth" },
  combined: { "2.4GHZ_BLUETOOTH": ["2.4GHZ", "BLUETOOTH"] },
  source: "specs",
};

export const CATEGORY_FACETS: Record<Category, FacetDefinition[]> = {
  gpu: [
    { key: "chipMaker", label: "Fabricante del chip", values: { nvidia: "NVIDIA", amd: "AMD", intel: "Intel" } },
    { key: "chipset", label: "Modelo" },
    { key: "vram", label: "Memoria mínima", unit: "GB", threshold: "min" },
    { key: "memory_type", label: "Tipo de memoria", source: "specs" },
    { key: "memory_bus_bit", label: "Bus de memoria", unit: "bits", source: "specs" },
    {
      key: "length_mm",
      label: "Largo máximo",
      unit: "mm",
      source: "specs",
      threshold: "max",
      steps: [200, 250, 300, 330, 360],
    },
    { key: "slots", label: "Ranuras máximas", unit: "ranuras", source: "specs", threshold: "max", steps: [2, 2.5, 3] },
    { key: "min_psu_w", label: "Fuente recomendada máxima", unit: "W", source: "specs", threshold: "max" },
    {
      key: "tdp_w",
      label: "Consumo máximo",
      unit: "W",
      source: "specs",
      threshold: "max",
      steps: [150, 200, 250, 300, 450],
    },
  ],
  cpu: [
    { key: "model", label: "Modelo" },
    { key: "socket", label: "Socket", source: "specs" },
    { key: "cores_total", label: "Núcleos mínimos", unit: "núcleos", source: "specs", threshold: "min" },
    { key: "threads", label: "Hilos mínimos", unit: "hilos", source: "specs", threshold: "min" },
    { key: "tdp_w", label: "TDP máximo", unit: "W", source: "specs", threshold: "max", steps: [35, 65, 105, 125, 170] },
    {
      key: "max_power_w",
      label: "Potencia máxima",
      unit: "W",
      source: "specs",
      threshold: "max",
      steps: [65, 120, 180, 250],
    },
    {
      key: "base_ghz",
      label: "Frecuencia base mínima",
      unit: "GHz",
      source: "specs",
      threshold: "min",
      steps: [3, 3.5, 4, 4.5],
    },
    {
      key: "boost_ghz",
      label: "Frecuencia boost mínima",
      unit: "GHz",
      source: "specs",
      threshold: "min",
      steps: [4, 4.5, 5, 5.5],
    },
    {
      key: "l3_mb",
      label: "Caché L3 mínima",
      unit: "MB",
      source: "specs",
      threshold: "min",
      steps: [8, 16, 32, 64, 96],
    },
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
    { key: "m2_slots", label: "Ranuras M.2 mínimas", unit: "M.2", source: "specs", threshold: "min" },
    { key: "memory_slots", label: "Ranuras de memoria", unit: "ranuras", source: "specs" },
    { key: "memory_max_gb", label: "Memoria admitida", unit: "GB", source: "specs", threshold: "min" },
    {
      key: "memory_max_speed_mt_s",
      label: "Velocidad de memoria admitida",
      unit: "MT/s",
      source: "specs",
      threshold: "min",
      steps: [3200, 4800, 6000, 7200, 8000],
    },
    { key: "pcie_x16_slots", label: "Ranuras PCIe x16 mínimas", unit: "ranuras", source: "specs", threshold: "min" },
    { key: "sata_ports", label: "Puertos SATA mínimos", unit: "SATA", source: "specs", threshold: "min" },
  ],
  ram: [
    { key: "type", label: "Tipo", values: MEMORY_TYPES },
    { key: "capacity", label: "Capacidad mínima", unit: "GB", threshold: "min" },
    { key: "speed", label: "Velocidad mínima", unit: "MT/s", threshold: "min" },
    { key: "modules", label: "Módulos", values: { "1": "1 módulo", "2": "Kit de 2", "4": "Kit de 4" } },
    { key: "formFactor", label: "Formato", values: { dimm: "PC (DIMM)", sodimm: "Notebook (SO-DIMM)" } },
    { key: "casLatency", label: "Latencia máxima", unit: "CL", threshold: "max" },
    { key: "rgb", label: "Iluminación", values: YES_NO("Con RGB", "Sin RGB") },
  ],
  psu: [
    { key: "wattage", label: "Potencia mínima", unit: "W", threshold: "min" },
    {
      key: "efficiency",
      label: "Certificación mínima",
      threshold: "min",
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
    {
      key: "length_mm",
      label: "Largo máximo",
      unit: "mm",
      source: "specs",
      threshold: "max",
      steps: [140, 150, 160, 180],
    },
    {
      key: "fanless",
      label: "Ventilador",
      values: YES_NO("Pasiva, sin ventilador", "Con ventilador"),
      source: "specs",
    },
    {
      key: "pcie_6_plus_2_pin",
      label: "Conectores PCIe 6+2 mínimos",
      unit: "conectores",
      source: "specs",
      threshold: "min",
      steps: [2, 3, 4, 6],
    },
    {
      key: "sata_connectors",
      label: "Conectores SATA mínimos",
      unit: "SATA",
      source: "specs",
      threshold: "min",
      steps: [4, 6, 8],
    },
  ],
  ssd: [
    { key: "capacity", label: "Capacidad mínima", unit: "GB", threshold: "min" },
    { key: "interface", label: "Interfaz", values: { nvme: "NVMe", sata: "SATA" } },
    { key: "formFactor", label: "Formato", values: { "2.5": '2,5"', "2230": "M.2 2230", "2280": "M.2 2280" } },
    { key: "pcieGen", label: "PCIe", values: { "3": "PCIe 3.0", "4": "PCIe 4.0", "5": "PCIe 5.0" } },
    {
      key: "read_speed_mb_s",
      label: "Lectura mínima",
      unit: "MB/s",
      source: "specs",
      threshold: "min",
      steps: [500, 2000, 3500, 5000, 7000, 10000, 14000],
    },
    {
      key: "tbw",
      label: "Durabilidad mínima",
      unit: "TBW",
      source: "specs",
      threshold: "min",
      steps: [150, 300, 600, 1200],
    },
    {
      key: "write_speed_mb_s",
      label: "Escritura mínima",
      unit: "MB/s",
      source: "specs",
      threshold: "min",
      steps: [500, 2000, 3500, 5000, 7000, 10000, 13000],
    },
  ],
  hdd: [
    { key: "capacity", label: "Capacidad mínima", unit: "GB", threshold: "min" },
    { key: "rpm", label: "Velocidad", unit: "RPM" },
    { key: "formFactor", label: "Formato", values: { "2.5": '2,5"', "3.5": '3,5"' } },
    {
      key: "cache_mb",
      label: "Caché mínima",
      unit: "MB",
      source: "specs",
      threshold: "min",
      steps: [64, 128, 256, 512],
    },
  ],
  cpu_cooler: [
    { key: "type", label: "Tipo", values: { air: "Por aire", aio: "Refrigeración líquida" } },
    { key: "radiatorMm", label: "Radiador", unit: "mm" },
    {
      key: "height_mm",
      label: "Alto máximo",
      unit: "mm",
      source: "specs",
      threshold: "max",
      steps: [140, 150, 160, 165, 170],
    },
    {
      key: "fan_count",
      label: "Ventiladores",
      values: { "1": "1 ventilador", "2": "2 ventiladores", "3": "3 ventiladores" },
      source: "specs",
    },
    {
      key: "noise_dba_max",
      label: "Ruido máximo",
      unit: "dBA",
      source: "specs",
      threshold: "max",
      steps: [20, 25, 30, 35],
    },
    {
      key: "tdp_rating_w",
      label: "TDP soportado mínimo",
      unit: "W",
      source: "specs",
      threshold: "min",
      steps: [150, 200, 250, 300],
    },
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
    {
      key: "max_gpu_length_mm",
      label: "Largo de GPU admitido",
      unit: "mm",
      source: "specs",
      threshold: "min",
      steps: [250, 300, 350, 400, 450],
    },
    {
      key: "max_cpu_cooler_height_mm",
      label: "Alto de cooler admitido",
      unit: "mm",
      source: "specs",
      threshold: "min",
      steps: [150, 160, 170, 180],
    },
    {
      key: "max_psu_length_mm",
      label: "Largo de fuente admitido",
      unit: "mm",
      source: "specs",
      threshold: "min",
      steps: [150, 160, 180, 200, 220],
    },
  ],
  case_fan: [
    { key: "sizeMm", label: "Tamaño", unit: "mm" },
    {
      key: "quantity",
      label: "Cantidad",
      values: { "1": "1 ventilador", "2": "Pack de 2", "3": "Pack de 3", "4": "Pack de 4" },
    },
    {
      key: "airflow_cfm_max",
      label: "Flujo de aire mínimo",
      unit: "CFM",
      source: "specs",
      threshold: "min",
      steps: [30, 40, 50, 60, 70],
    },
    {
      key: "noise_dba_max",
      label: "Ruido máximo",
      unit: "dBA",
      source: "specs",
      threshold: "max",
      steps: [20, 25, 30, 35],
    },
    { key: "pwm", label: "Control de velocidad", values: YES_NO("Con PWM", "Sin PWM"), source: "specs" },
    {
      key: "rpm_max",
      label: "Velocidad mínima",
      unit: "RPM",
      source: "specs",
      threshold: "min",
      steps: [1200, 1500, 1800, 2000],
    },
    {
      key: "static_pressure_mmh2o",
      label: "Presión estática mínima",
      unit: "mmH₂O",
      source: "specs",
      threshold: "min",
      steps: [1, 1.5, 2, 3],
    },
  ],
  keyboard: [
    {
      key: "form_factor",
      label: "Formato",
      source: "specs",
      // Las specs de texto llegan en mayúsculas y sin espacios (`jsonText` con `clean`).
      values: { FULL: "100 %", TKL: "TKL", "75": "75 %", "65": "65 %", "60": "60 %" },
      order: ["FULL", "TKL", "75", "65", "60"],
    },
    {
      key: "switch_type",
      label: "Tipo de switch",
      source: "specs",
      values: {
        LINEAR: "Lineal",
        TACTILE: "Táctil",
        CLICKY: "Clicky",
        OPTICAL: "Óptico",
        MAGNETIC: "Magnético",
        MEMBRANE: "Membrana",
        SCISSOR: "Tijera",
      },
      order: ["LINEAR", "TACTILE", "CLICKY", "OPTICAL", "MAGNETIC", "MEMBRANE", "SCISSOR"],
      closed: true,
    },
    { key: "wireless", label: "Conexión", values: YES_NO("Inalámbrico", "Con cable"), source: "specs" },
    CONNECTION,
  ],
  mouse: [
    { key: "wireless", label: "Conexión", values: YES_NO("Inalámbrico", "Con cable"), source: "specs" },
    CONNECTION,
    {
      key: "weight_g",
      label: "Peso máximo",
      unit: "g",
      source: "specs",
      threshold: "max",
      steps: [60, 80, 100, 120],
    },
    {
      key: "max_dpi",
      label: "DPI mínimo",
      unit: "DPI",
      source: "specs",
      threshold: "min",
      steps: [3200, 8000, 16000, 26000],
    },
    {
      key: "buttons",
      label: "Botones mínimos",
      unit: "botones",
      source: "specs",
      threshold: "min",
      steps: [3, 5, 6, 8, 12],
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
  return facet.unit ? `${value.replace(".", ",")} ${facet.unit}` : value.toUpperCase();
}

/** Valor como opción de un filtro con umbral: "12 GB o más", "CL16 o menos", "80 Plus Gold o superior". */
export function facetOptionLabel(facet: FacetDefinition, value: string): string {
  const label = facetValueLabel(facet, value);
  if (facet.threshold === "max") return `${label} o menos`;
  if (facet.threshold === "min") return `${label}${facet.values ? " o superior" : " o más"}`;
  return label;
}

/** Valores de una faceta con umbral y escala propia (la certificación), de menor a mayor; null si compara por número. */
export function facetScale(facet: FacetDefinition): string[] | null {
  return facet.threshold && facet.values ? Object.keys(facet.values) : null;
}

/** Opciones por las que cuenta un valor guardado (él mismo, o sus partes si es `combined`). */
export function facetOptionsOf(facet: FacetDefinition, value: string): readonly string[] {
  return facet.combined?.[value] ?? [value];
}

/** Valores guardados que trae elegir estas opciones: ellas más los `combined` que incluyen alguna. */
export function facetStoredValues(facet: FacetDefinition, picked: readonly string[]): string[] {
  const combos = Object.entries(facet.combined ?? {}).filter(([, parts]) => parts.some((p) => picked.includes(p)));
  return [...picked, ...combos.map(([stored]) => stored)];
}

export function facetsFor(category: Category): FacetDefinition[] {
  return CATEGORY_FACETS[category];
}

/** Forma de `spec=<clave>:<valor>`; la web la valida sin zod. */
export const SPEC_FILTER_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,31}:[^:]{1,60}$/;
