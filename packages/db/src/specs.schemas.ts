import { z } from "zod";

export const GpuSchema = z.object({
  manufacturer: z.string(),
  gpu_model: z.string(),
  memory: z.string(),
  bus: z.string(),
  frequencies: z.string(),
  memory_frequency: z.string(),
  core: z.string(),
  profile: z.string(),
  cooling: z.string(),
  slots: z.string(),
  length: z.string(),
  illumination: z.string(),
  backplate: z.boolean(),
  power_connectors: z.array(z.string()),
  video_ports: z.array(z.string()),
});

export const CpuSchema = z.object({
  manufacturer: z.string(),
  frequency: z.string(),
  frequency_turbo: z.string(),
  cores_threads: z.string(),
  cache: z.string(),
  socket: z.string(),
  core_name: z.string(),
  manufacturing_process: z.string(),
  tdp: z.string(),
  cooler_included: z.boolean(),
  integrated_graphics: z.string(),
});

export const PsuSchema = z.object({
  manufacturer: z.string(),
  wattage: z.string().regex(/\d+\s*W/, "Formato de wattage debe ser 'NNN W' o similar"),
  certification: z.string(),
  form_factor: z.string(),
  pfc_active: z.boolean(),
  modular: z.string(),
  rail_12v: z.string(),
  rail_5v: z.string(),
  rail_3v3: z.string(),
  power_connectors: z.array(z.string()),
});

export const MotherboardSchema = z.object({
  manufacturer: z.string(),
  socket: z.string(),
  chipset: z.string(),
  memory_slots: z.string(),
  memory_channels: z.string(),
  form_factor: z.string(),
  rgb_support: z.array(z.string()),
  video_ports: z.array(z.string()),
  power_connectors: z.array(z.string()),
  integrated_graphics: z.string(),
  sli_support: z.boolean(),
  crossfire_support: z.boolean(),
  raid_support: z.boolean(),
  storage_connectors: z.array(z.string()),
  io_ports: z.array(z.string()),
  expansion_slots: z.array(z.string()),
});

export const CaseSchema = z.object({
  manufacturer: z.string(),
  max_motherboard_size: z.string(),
  psu_included: z.string(),
  side_panel: z.string(),
  color: z.string(),
  illumination: z.string(),
  dimensions: z.string(),
  max_gpu_length: z.string(),
  max_cooler_height: z.string(),
  weight: z.string(),
  psu_position: z.string(),
  expansion_slots: z.string(),
  front_ports: z.array(z.string()),
  drive_bays: z.array(z.string()),
  front_fans: z.string(),
  rear_fans: z.string(),
  side_fans: z.string(),
  top_fans: z.string(),
  bottom_fans: z.string(),
  included_fans: z.string(),
});

export const RamSchema = z.object({
  manufacturer: z.string(),
  // capacity: prefer format 'N x X GB' but keep permissive to allow titles like '16 GB'
  capacity: z
    .string()
    .regex(/\d+\s*x\s*\d+\s*GB/, "Formato debe ser N x X GB")
    .or(z.string()),
  type: z.string(),
  speed: z.string(),
  format: z.string(),
  voltage: z
    .string()
    .regex(/\d+(\.\d+)?\s*V/, "El voltaje debe contener 'V'")
    .or(z.string()),
  latency_cl: z.string(),
  latency_trcd: z.string(),
  latency_trp: z.string(),
  latency_tras: z.string(),
  ecc_support: z.boolean(),
  full_buffered: z.boolean(),
});

export const HddSchema = z.object({
  manufacturer: z.string(),
  type: z.string(),
  line: z.string(),
  capacity: z.string(),
  rpm: z.string(),
  size: z.string(),
  bus: z.string(),
  buffer: z.string(),
});

export const SsdSchema = z.object({
  manufacturer: z.string(),
  line: z.string(),
  capacity: z.string(),
  format: z.string(),
  bus: z.string(),
  has_dram: z.boolean(),
  nand_type: z.string(),
  controller: z.string(),
  read_speed: z.string(),
  write_speed: z.string(),
});

export const CaseFanSchema = z.object({
  manufacturer: z.string(),
  size: z.string(),
  rpm: z.string(),
  airflow: z.string(),
  static_pressure: z.string(),
  noise_level: z.string(),
  illumination: z.string(),
  lighting_control: z.string(),
  bearing: z.string(),
  fans_included: z.string(),
  includes_hub: z.boolean(),
  power_connectors: z.array(z.string()),
});

export const CpuCoolerSchema = z.object({
  manufacturer: z.string(),
  type: z.string(),
  fan_size: z.string(),
  height: z.string(),
  weight: z.string(),
  rpm: z.string(),
  airflow: z.string(),
  noise_level: z.string(),
  has_heatpipes: z.boolean(),
  illumination: z.string(),
  compatible_sockets: z.array(z.string()),
});

// Union schema for ProductSpecs
export const ProductSpecsSchema = z.union([
  GpuSchema,
  CpuSchema,
  PsuSchema,
  MotherboardSchema,
  CaseSchema,
  RamSchema,
  HddSchema,
  SsdSchema,
  CaseFanSchema,
  CpuCoolerSchema,
]);
