import { z } from "zod";

// Helper for nullable/optional fields
const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableBoolean = z.boolean().nullable().optional();
const nullableStringArray = z.array(z.string()).nullable().optional();

export const GpuSchema = z.object({
  manufacturer: nullableString, // e.g. ASUS, MSI (Board partner)
  chipset_manufacturer: z.enum(["NVIDIA", "AMD", "Intel"]).nullable().optional(),
  chipset: nullableString, // e.g. GeForce RTX 4090
  memory_gb: nullableNumber,
  memory_type: nullableString, // e.g. GDDR6X
  core_base_clock_mhz: nullableNumber,
  core_boost_clock_mhz: nullableNumber,
  core_count: nullableNumber,
  memory_clock_mhz: nullableNumber,
  memory_bus_bit: nullableNumber,
  interface: nullableString, // e.g. PCIe 4.0 x16
  length_mm: nullableNumber,
  tdp_w: nullableNumber,
  cooling: nullableString, // e.g. 3 Fans
  slots: nullableNumber, // Total slot width
  frame_sync: nullableString, // G-Sync, FreeSync
  color: nullableStringArray,
  power_connectors: z
    .object({
      pcie_6_pin: nullableNumber,
      pcie_8_pin: nullableNumber,
      pcie_12vhpwr: nullableNumber, // 16-pin
    })
    .nullable()
    .optional(),
  video_ports: z
    .object({
      hdmi: nullableNumber,
      displayport: nullableNumber,
      dvi: nullableNumber,
      vga: nullableNumber,
    })
    .nullable()
    .optional(),
});

export const CpuSchema = z.object({
  manufacturer: nullableString, // Intel, AMD
  series: nullableString, // Core i9, Ryzen 9
  microarchitecture: nullableString, // Raptor Lake, Zen 4
  socket: nullableString, // LGA 1700, AM5
  cores: z
    .object({
      total: nullableNumber,
      performance: nullableNumber,
      efficiency: nullableNumber,
      threads: nullableNumber,
    })
    .nullable()
    .optional(),
  clocks: z
    .object({
      base_ghz: nullableNumber,
      boost_ghz: nullableNumber,
    })
    .nullable()
    .optional(),
  cache: z
    .object({
      l1: nullableString,
      l2_mb: nullableNumber,
      l3_mb: nullableNumber,
    })
    .nullable()
    .optional(),
  tdp_w: nullableNumber,
  integrated_graphics: nullableString, // Model name or null
  includes_cooler: nullableBoolean,
  ecc_support: nullableBoolean,
  lithography: nullableString,
  max_memory_gb: nullableNumber,
  memory_types: nullableStringArray, // DDR4, DDR5
});

export const PsuSchema = z.object({
  manufacturer: nullableString,
  wattage: nullableNumber,
  form_factor: nullableString, // ATX, SFX
  efficiency_rating: nullableString, // 80+ Gold
  modular: z.enum(["Full", "Semi", "No", "Unknown"]).nullable().optional(),
  fanless: nullableBoolean,
  connectors: z
    .object({
      atx_24_pin: nullableNumber,
      eps_8_pin: nullableNumber,
      pcie_12vhpwr: nullableNumber,
      pcie_6_plus_2_pin: nullableNumber,
      sata: nullableNumber,
      molex: nullableNumber,
    })
    .nullable()
    .optional(),
  color: nullableStringArray,
  length_mm: nullableNumber,
});

export const MotherboardSchema = z.object({
  manufacturer: nullableString,
  socket: nullableString,
  form_factor: nullableString, // ATX, Micro ATX
  chipset: nullableString, // Z790, X670E
  memory: z
    .object({
      max_gb: nullableNumber,
      type: nullableString, // DDR5
      slots: nullableNumber,
    })
    .nullable()
    .optional(),
  pcie_slots: z
    .array(
      z.object({
        gen: nullableString, // 5.0, 4.0
        quantity: nullableNumber,
        lanes: nullableNumber, // 16, 8, 4
      }),
    )
    .nullable()
    .optional(),
  m2_slots: z
    .array(
      z.object({
        size: nullableString, // 2280
        key: nullableString, // M
        interface: nullableString, // PCIe 4.0 x4
      }),
    )
    .nullable()
    .optional(),
  sata_ports: nullableNumber,
  onboard_ethernet: nullableStringArray, // ["2.5 Gb/s", "1 Gb/s"]
  wireless_networking: nullableString, // Wifi 6E
  usb_headers: z.record(z.string(), nullableNumber).nullable().optional(), // "usb_2_0": 2
  color: nullableStringArray,
});

export const CaseSchema = z.object({
  manufacturer: nullableString,
  form_factor: nullableString, // ATX Mid Tower
  supported_motherboard_form_factors: nullableStringArray,
  side_panel: nullableString, // Tempered Glass, Mesh
  color: nullableStringArray,
  dimensions_mm: z
    .object({
      width: nullableNumber,
      height: nullableNumber,
      depth: nullableNumber,
    })
    .nullable()
    .optional(),
  max_gpu_length_mm: nullableNumber,
  max_cpu_cooler_height_mm: nullableNumber,
  drive_bays: z
    .object({
      internal_3_5: nullableNumber,
      internal_2_5: nullableNumber,
    })
    .nullable()
    .optional(),
  expansion_slots: nullableNumber,
  front_ports: nullableStringArray,
  included_fans: nullableNumber,
});

export const RamSchema = z.object({
  manufacturer: nullableString,
  speed_mt_s: nullableNumber, // 6000
  type: nullableString, // DDR5
  modules: z
    .object({
      quantity: nullableNumber,
      capacity_gb: nullableNumber,
    })
    .nullable()
    .optional(),
  total_capacity_gb: nullableNumber,
  cas_latency: nullableNumber,
  timings: nullableString, // 30-36-36-76
  voltage: nullableNumber,
  ecc: nullableBoolean,
  heat_spreader: nullableBoolean,
  rgb: nullableBoolean,
  color: nullableStringArray,
});

export const StorageSchema = z.object({
  manufacturer: nullableString,
  type: z.enum(["SSD", "HDD", "SSHD"]).nullable().optional(),
  capacity_gb: nullableNumber,
  interface: nullableString, // PCIe 4.0 x4, SATA
  form_factor: nullableString, // M.2-2280, 3.5"
  cache_mb: nullableNumber,
  rpm: nullableNumber, // For HDD
  nvme: nullableBoolean, // For SSD
  read_speed_mb_s: nullableNumber,
  write_speed_mb_s: nullableNumber,
});

// Alias for backward compatibility if needed, or we can migrate
export const HddSchema = StorageSchema;
export const SsdSchema = StorageSchema;

export const CaseFanSchema = z.object({
  manufacturer: nullableString,
  size_mm: nullableNumber,
  quantity: nullableNumber,
  rpm: z
    .object({
      min: nullableNumber,
      max: nullableNumber,
    })
    .nullable()
    .optional(),
  airflow_cfm: z
    .object({
      min: nullableNumber,
      max: nullableNumber,
    })
    .nullable()
    .optional(),
  noise_level_db: z
    .object({
      min: nullableNumber,
      max: nullableNumber,
    })
    .nullable()
    .optional(),
  pwm: nullableBoolean,
  rgb: nullableBoolean, // Simplified from led type
  static_pressure_mmh2o: nullableNumber,
  color: nullableStringArray,
});

export const CpuCoolerSchema = z.object({
  manufacturer: nullableString,
  type: z.enum(["Air", "AIO", "Custom Loop", "Fanless"]).nullable().optional(),
  height_mm: nullableNumber,
  fan_rpm: z
    .object({
      min: nullableNumber,
      max: nullableNumber,
    })
    .nullable()
    .optional(),
  noise_level_db: z
    .object({
      min: nullableNumber,
      max: nullableNumber,
    })
    .nullable()
    .optional(),
  water_cooled: nullableBoolean,
  radiator_size_mm: nullableNumber,
  fan_size_mm: nullableNumber,
  color: nullableStringArray,
  sockets: nullableStringArray,
});

// Union schema for ProductSpecs
export const ProductSpecsSchema = z.union([
  GpuSchema,
  CpuSchema,
  PsuSchema,
  MotherboardSchema,
  CaseSchema,
  RamSchema,
  StorageSchema,
  CaseFanSchema,
  CpuCoolerSchema,
]);
