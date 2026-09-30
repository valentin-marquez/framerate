import { z } from "zod";
import type { Category } from "./categories";

/**
 * Especificaciones técnicas estructuradas por categoría. Fuente única para:
 *  - la ficha del producto (web),
 *  - los filtros/facetas del explorador (se aplanan a `product_spec_values`),
 *  - las reglas de compatibilidad del armador de cotizaciones.
 *
 * Reglas:
 *  - Todo campo es opcional y `null` = desconocido. Nunca strings centinela
 *    ("Desconocido", "N/A"): ensucian filtros y reglas.
 *  - Valores categóricos como enums en minúsculas (la web los traduce). Así
 *    un filtro "gold" no depende de si la tienda escribió "80+ Gold" u "80 PLUS GOLD".
 *  - La marca NO va aquí (vive en `products.brand`).
 *  - Unidades en el nombre del campo: `_mm`, `_w`, `_gb`, `_mhz`, `_mt_s`.
 */

const num = z.number().finite().nonnegative().nullable().optional();
const int = z.number().int().nonnegative().nullable().optional();
const bool = z.boolean().nullable().optional();
const text = z.string().trim().min(1).max(120);
const str = text.nullable().optional();
const list = <T extends z.ZodType>(item: T) => z.array(item).max(50).nullable().optional();
const range = z.object({ min: num, max: num }).nullable().optional();

export const MemoryTypeSchema = z.enum(["ddr3", "ddr4", "ddr5"]);
export const BoardFormFactorSchema = z.enum(["eatx", "atx", "matx", "itx"]);
export const PsuEfficiencySchema = z.enum(["white", "bronze", "silver", "gold", "platinum", "titanium"]);

export const GpuSpecsSchema = z.object({
  chipset_manufacturer: z.enum(["nvidia", "amd", "intel"]).nullable().optional(),
  /** "rtx 4070 super", "rx 7800 xt", "arc b580" (mismo formato que el matching). */
  chipset: str,
  architecture: str,
  memory_gb: num,
  memory_type: z.enum(["gddr5", "gddr6", "gddr6x", "gddr7", "hbm2", "hbm3"]).nullable().optional(),
  memory_bus_bit: int,
  core_base_clock_mhz: num,
  core_boost_clock_mhz: num,
  core_count: int,
  interface: str,
  length_mm: num,
  slots: num,
  tdp_w: num,
  frame_sync: list(z.enum(["gsync", "freesync"])),
  power_connectors: z.object({ pcie_6_pin: int, pcie_8_pin: int, pcie_12vhpwr: int }).nullable().optional(),
  video_ports: z.object({ hdmi: int, displayport: int, dvi: int, vga: int }).nullable().optional(),
  color: list(text),
});

export const CpuSpecsSchema = z.object({
  series: str,
  microarchitecture: str,
  /** Normalizado: "am4", "am5", "lga1700", "lga1851". */
  socket: str,
  cores: z.object({ total: int, performance: int, efficiency: int, threads: int }).nullable().optional(),
  clocks: z.object({ base_ghz: num, boost_ghz: num }).nullable().optional(),
  cache: z.object({ l2_mb: num, l3_mb: num }).nullable().optional(),
  tdp_w: num,
  /** Modelo de la gráfica integrada, o null si no tiene. */
  integrated_graphics: str,
  includes_cooler: bool,
  ecc_support: bool,
  lithography_nm: num,
  max_memory_gb: num,
  memory_types: list(MemoryTypeSchema),
});

export const MotherboardSpecsSchema = z.object({
  socket: str,
  chipset: str,
  form_factor: BoardFormFactorSchema.nullable().optional(),
  memory: z
    .object({
      type: MemoryTypeSchema.nullable().optional(),
      slots: int,
      max_gb: num,
      /** Velocidad máxima soportada (regla de compatibilidad RAM). */
      max_speed_mt_s: num,
    })
    .nullable()
    .optional(),
  pcie_slots: list(z.object({ gen: num, lanes: int, quantity: int })),
  m2_slots: list(z.object({ size: str, key: str, interface: str })),
  sata_ports: int,
  wifi: str,
  ethernet: list(text),
  color: list(text),
});

export const RamSpecsSchema = z.object({
  type: MemoryTypeSchema.nullable().optional(),
  form_factor: z.enum(["dimm", "sodimm"]).nullable().optional(),
  speed_mt_s: num,
  modules: z.object({ quantity: int, capacity_gb: num }).nullable().optional(),
  total_capacity_gb: num,
  cas_latency: num,
  timings: str,
  voltage: num,
  ecc: bool,
  rgb: bool,
  heat_spreader: bool,
  color: list(text),
});

export const PsuSpecsSchema = z.object({
  wattage: num,
  efficiency_rating: PsuEfficiencySchema.nullable().optional(),
  form_factor: z.enum(["atx", "sfx", "sfx_l", "tfx"]).nullable().optional(),
  modular: z.enum(["full", "semi", "none"]).nullable().optional(),
  atx_version: str,
  fanless: bool,
  length_mm: num,
  connectors: z
    .object({
      atx_24_pin: int,
      eps_8_pin: int,
      pcie_6_plus_2_pin: int,
      pcie_12vhpwr: int,
      sata: int,
      molex: int,
    })
    .nullable()
    .optional(),
});

const StorageSpecsSchema = z.object({
  capacity_gb: num,
  interface: z.enum(["sata", "nvme", "sas", "usb"]).nullable().optional(),
  pcie_gen: num,
  form_factor: z.enum(["m2_2230", "m2_2242", "m2_2280", "2_5", "3_5"]).nullable().optional(),
  read_speed_mb_s: num,
  write_speed_mb_s: num,
  cache_mb: num,
});

export const SsdSpecsSchema = StorageSpecsSchema.extend({
  nand_type: z.enum(["slc", "mlc", "tlc", "qlc"]).nullable().optional(),
  dram_cache: bool,
  tbw: num,
});

export const HddSpecsSchema = StorageSpecsSchema.extend({ rpm: num });

export const CaseSpecsSchema = z.object({
  form_factor: z.enum(["full_tower", "mid_tower", "mini_tower", "sff", "htpc"]).nullable().optional(),
  supported_motherboard_form_factors: list(BoardFormFactorSchema),
  side_panel: z.enum(["tempered_glass", "mesh", "solid", "acrylic"]).nullable().optional(),
  max_gpu_length_mm: num,
  max_cpu_cooler_height_mm: num,
  max_psu_length_mm: num,
  expansion_slots: int,
  drive_bays: z.object({ internal_3_5: int, internal_2_5: int }).nullable().optional(),
  included_fans: int,
  radiator_support_mm: list(z.number().finite().nonnegative()),
  dimensions_mm: z.object({ width: num, height: num, depth: num }).nullable().optional(),
  front_ports: list(text),
  color: list(text),
});

export const CpuCoolerSpecsSchema = z.object({
  type: z.enum(["air", "aio", "custom_loop", "fanless"]).nullable().optional(),
  height_mm: num,
  radiator_size_mm: num,
  fan_size_mm: num,
  fan_count: int,
  fan_rpm: range,
  noise_level_db: range,
  tdp_rating_w: num,
  sockets: list(text),
  rgb: bool,
  color: list(text),
});

export const CaseFanSpecsSchema = z.object({
  size_mm: num,
  quantity: int,
  rpm: range,
  airflow_cfm: range,
  static_pressure_mmh2o: num,
  noise_level_db: range,
  pwm: bool,
  rgb: bool,
  color: list(text),
});

export const SPEC_SCHEMAS = {
  gpu: GpuSpecsSchema,
  cpu: CpuSpecsSchema,
  motherboard: MotherboardSpecsSchema,
  ram: RamSpecsSchema,
  psu: PsuSpecsSchema,
  ssd: SsdSpecsSchema,
  hdd: HddSpecsSchema,
  cpu_cooler: CpuCoolerSpecsSchema,
  case: CaseSpecsSchema,
  case_fan: CaseFanSpecsSchema,
} as const satisfies Record<Category, z.ZodObject>;

export type SpecsFor<C extends Category> = z.infer<(typeof SPEC_SCHEMAS)[C]>;
export type AnySpecs = { [C in Category]: SpecsFor<C> }[Category];

/** Una fila de faceta: ruta aplanada + valor numérico o textual. */
export interface SpecFacet {
  key: string;
  valueText: string | null;
  valueNum: number | null;
}

/**
 * Aplana specs anidadas a filas de faceta para `product_spec_values`:
 *   { cores: { total: 8 }, memory_types: ["ddr5"] }
 *   → cores.total=8, memory_types="ddr5"
 * Arrays de primitivos → una fila por elemento (filtro multi-valor).
 * Arrays de objetos (slots PCIe, M.2) → sólo su cantidad como `<key>.count`.
 * Booleanos → 0/1 numérico. `null` se omite (desconocido no filtra).
 */
export function flattenSpecs(specs: Record<string, unknown>, prefix = ""): SpecFacet[] {
  const out: SpecFacet[] = [];
  for (const [k, v] of Object.entries(specs)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) continue;
    if (typeof v === "number") out.push({ key, valueText: null, valueNum: v });
    else if (typeof v === "boolean") out.push({ key, valueText: null, valueNum: v ? 1 : 0 });
    else if (typeof v === "string") out.push({ key, valueText: v, valueNum: null });
    else if (Array.isArray(v)) {
      if (v.every((x) => typeof x === "string")) {
        for (const x of new Set(v as string[])) out.push({ key, valueText: x, valueNum: null });
      } else if (v.every((x) => typeof x === "number")) {
        for (const x of new Set(v as number[])) out.push({ key, valueText: null, valueNum: x });
      } else {
        out.push({ key: `${key}.count`, valueText: null, valueNum: v.length });
      }
    } else if (typeof v === "object") {
      out.push(...flattenSpecs(v as Record<string, unknown>, key));
    }
  }
  return out;
}
