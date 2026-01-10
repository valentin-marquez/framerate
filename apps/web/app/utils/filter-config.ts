import type { CategoryFilter } from "~/services/categories";

/**
 * Configuración de filtros por categoría basada en specs.schemas.ts
 * Cada categoría tiene filtros específicos que corresponden a sus especificaciones
 */

export const CATEGORY_FILTERS: Record<string, CategoryFilter[]> = {
  "tarjetas-de-video": [
    { name: "Fabricante del chip", slug: "chipset_manufacturer", type: "select", options: ["NVIDIA", "AMD", "Intel"] },
    { name: "Memoria", slug: "memory_gb", type: "range", unit: "GB", min: 4, max: 24 },
    { name: "Tipo de memoria", slug: "memory_type", type: "select", options: ["GDDR6X", "GDDR6", "GDDR5X", "GDDR5"] },
    { name: "TDP", slug: "tdp_w", type: "range", unit: "W", min: 75, max: 450 },
    { name: "Largo", slug: "length_mm", type: "range", unit: "mm", min: 150, max: 400 },
    { name: "Frame Sync", slug: "frame_sync", type: "select", options: ["G-Sync", "FreeSync", "G-Sync Compatible"] },
  ],

  procesadores: [
    { name: "Fabricante", slug: "manufacturer", type: "select", options: ["Intel", "AMD"] },
    { name: "Socket", slug: "socket", type: "select", options: ["LGA 1700", "LGA 1200", "AM5", "AM4", "LGA 1851"] },
    { name: "Núcleos totales", slug: "cores.total", type: "range", min: 2, max: 24 },
    { name: "TDP", slug: "tdp_w", type: "range", unit: "W", min: 35, max: 253 },
    { name: "Gráficos integrados", slug: "integrated_graphics", type: "boolean" },
    { name: "Incluye cooler", slug: "includes_cooler", type: "boolean" },
  ],

  "memorias-ram": [
    { name: "Tipo", slug: "type", type: "select", options: ["DDR5", "DDR4", "DDR3"] },
    { name: "Velocidad", slug: "speed_mt_s", type: "range", unit: "MT/s", min: 2133, max: 8000 },
    { name: "Capacidad total", slug: "total_capacity_gb", type: "range", unit: "GB", min: 8, max: 128 },
    { name: "CAS Latency", slug: "cas_latency", type: "range", min: 14, max: 40 },
    { name: "RGB", slug: "rgb", type: "boolean" },
    { name: "ECC", slug: "ecc", type: "boolean" },
  ],

  "placas-madre": [
    { name: "Socket", slug: "socket", type: "select", options: ["LGA 1700", "LGA 1200", "AM5", "AM4", "LGA 1851"] },
    {
      name: "Factor de forma",
      slug: "form_factor",
      type: "select",
      options: ["ATX", "Micro ATX", "Mini ITX", "E-ATX"],
    },
    { name: "Chipset", slug: "chipset", type: "select" },
    { name: "Slots de RAM", slug: "memory.slots", type: "range", min: 2, max: 8 },
    { name: "Tipo de memoria", slug: "memory.type", type: "select", options: ["DDR5", "DDR4"] },
    { name: "Puertos SATA", slug: "sata_ports", type: "range", min: 2, max: 10 },
  ],

  "fuentes-de-poder": [
    { name: "Potencia", slug: "wattage", type: "range", unit: "W", min: 400, max: 1600 },
    {
      name: "Certificación",
      slug: "efficiency_rating",
      type: "select",
      options: ["80+ Titanium", "80+ Platinum", "80+ Gold", "80+ Silver", "80+ Bronze", "80+ White"],
    },
    { name: "Modular", slug: "modular", type: "select", options: ["Full", "Semi", "No"] },
    { name: "Factor de forma", slug: "form_factor", type: "select", options: ["ATX", "SFX", "SFX-L", "TFX"] },
    { name: "Fanless", slug: "fanless", type: "boolean" },
  ],

  gabinetes: [
    {
      name: "Factor de forma",
      slug: "form_factor",
      type: "select",
      options: ["ATX Full Tower", "ATX Mid Tower", "Micro ATX Mini Tower", "Mini ITX Tower"],
    },
    {
      name: "Panel lateral",
      slug: "side_panel",
      type: "select",
      options: ["Tempered Glass", "Mesh", "Solid", "Acrylic"],
    },
    { name: "Largo máx. GPU", slug: "max_gpu_length_mm", type: "range", unit: "mm", min: 200, max: 450 },
    { name: "Altura máx. cooler", slug: "max_cpu_cooler_height_mm", type: "range", unit: "mm", min: 100, max: 200 },
    { name: 'Bahías 3.5"', slug: "drive_bays.internal_3_5", type: "range", min: 0, max: 10 },
    { name: 'Bahías 2.5"', slug: "drive_bays.internal_2_5", type: "range", min: 0, max: 10 },
  ],

  ssd: [
    { name: "Capacidad", slug: "capacity_gb", type: "range", unit: "GB", min: 120, max: 8000 },
    {
      name: "Factor de forma",
      slug: "form_factor",
      type: "select",
      options: ["M.2-2280", "M.2-2260", "M.2-2242", '2.5"'],
    },
    {
      name: "Interfaz",
      slug: "interface",
      type: "select",
      options: ["PCIe 5.0 x4", "PCIe 4.0 x4", "PCIe 3.0 x4", "SATA III"],
    },
    { name: "NVMe", slug: "nvme", type: "boolean" },
    { name: "Lectura", slug: "read_speed_mb_s", type: "range", unit: "MB/s", min: 500, max: 14000 },
    { name: "Escritura", slug: "write_speed_mb_s", type: "range", unit: "MB/s", min: 500, max: 12000 },
  ],

  "discos-duros": [
    { name: "Capacidad", slug: "capacity_gb", type: "range", unit: "GB", min: 500, max: 22000 },
    { name: "RPM", slug: "rpm", type: "select", options: ["7200", "5400", "5900", "10000"] },
    { name: "Factor de forma", slug: "form_factor", type: "select", options: ['3.5"', '2.5"'] },
    { name: "Caché", slug: "cache_mb", type: "range", unit: "MB", min: 32, max: 512 },
  ],

  "coolers-cpu": [
    { name: "Tipo", slug: "type", type: "select", options: ["Air", "AIO", "Custom Loop", "Fanless"] },
    { name: "Socket", slug: "sockets", type: "select", options: ["LGA 1700", "LGA 1200", "AM5", "AM4", "LGA 1851"] },
    { name: "Tamaño radiador", slug: "radiator_size_mm", type: "select", options: ["120", "240", "280", "360", "420"] },
    { name: "Altura", slug: "height_mm", type: "range", unit: "mm", min: 30, max: 170 },
    { name: "Ruido máx.", slug: "noise_level_db.max", type: "range", unit: "dB", min: 15, max: 50 },
  ],

  ventiladores: [
    { name: "Tamaño", slug: "size_mm", type: "select", options: ["40", "60", "80", "92", "120", "140", "200"] },
    { name: "RPM máx.", slug: "rpm.max", type: "range", min: 500, max: 3000 },
    { name: "Flujo de aire máx.", slug: "airflow_cfm.max", type: "range", unit: "CFM", min: 10, max: 100 },
    { name: "PWM", slug: "pwm", type: "boolean" },
    { name: "RGB", slug: "rgb", type: "boolean" },
  ],
};

/**
 * Obtiene los filtros para una categoría específica
 */
export function getFiltersForCategory(categorySlug: string): CategoryFilter[] {
  return CATEGORY_FILTERS[categorySlug] || [];
}

/**
 * Filtros globales que aplican a todas las categorías
 */
export const GLOBAL_FILTERS: CategoryFilter[] = [{ name: "Fabricante", slug: "manufacturer", type: "select" }];
