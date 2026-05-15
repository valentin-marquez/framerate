/**
 * Factories de productos de prueba para el motor de compatibilidad.
 * Producen `BuildProduct` mínimos pero realistas; cada factory acepta
 * overrides para forzar escenarios edge.
 */

import type {
  BuildProduct,
  CaseSpecs,
  CpuCoolerSpecs,
  CpuSpecs,
  GpuSpecs,
  MotherboardSpecs,
  PsuSpecs,
  RamSpecs,
  StorageSpecs,
} from "@framerate/db";

type Overrides<T> = Partial<T>;

function makeProduct<S extends object>(
  name: string,
  categorySlug: string,
  categoryName: string,
  brandName: string,
  specs: S,
  quantity = 1,
): BuildProduct {
  return {
    name,
    specs: specs as unknown as BuildProduct["specs"],
    category: { slug: categorySlug, name: categoryName },
    brand: { name: brandName },
    quantity,
  };
}

export function makeCpu(overrides: Overrides<CpuSpecs> = {}): BuildProduct {
  const specs: CpuSpecs = {
    manufacturer: "AMD",
    series: "Ryzen 7",
    microarchitecture: "Zen 5",
    socket: "AM5",
    cores: { total: 8, performance: 8, efficiency: 0, threads: 16 },
    clocks: { base_ghz: 3.8, boost_ghz: 5.5 },
    cache: { l1: null, l2_mb: 8, l3_mb: 32 },
    tdp_w: 65,
    integrated_graphics: "Radeon Graphics",
    includes_cooler: false,
    ecc_support: null,
    lithography: "4nm",
    max_memory_gb: 192,
    memory_types: ["DDR5"],
    ...overrides,
  };
  return makeProduct("AMD Ryzen 7 9700X", "cpu", "CPU", "AMD", specs);
}

export function makeMobo(overrides: Overrides<MotherboardSpecs> = {}): BuildProduct {
  const specs: MotherboardSpecs = {
    manufacturer: "ASUS",
    socket: "AM5",
    form_factor: "Micro ATX",
    chipset: "B650M",
    memory: { max_gb: 192, type: "DDR5", slots: 4 },
    pcie_slots: [{ gen: "5.0", quantity: 1, lanes: 16 }],
    m2_slots: [
      { size: "2280", key: "M", interface: "PCIe 4.0 x4" },
      { size: "2280", key: "M", interface: "PCIe 4.0 x4" },
    ],
    sata_ports: 4,
    onboard_ethernet: ["2.5 Gb/s"],
    wireless_networking: "Wifi 6",
    usb_headers: null,
    color: ["Black"],
    ...overrides,
  };
  return makeProduct("ASUS TUF B650M-F", "motherboard", "Motherboard", "ASUS", specs);
}

export function makeRam(overrides: Overrides<RamSpecs> = {}, quantity = 1): BuildProduct {
  const specs: RamSpecs = {
    manufacturer: "Corsair",
    speed_mt_s: 6000,
    type: "DDR5",
    modules: { quantity: 2, capacity_gb: 16 },
    total_capacity_gb: 32,
    cas_latency: 30,
    timings: "30-36-36-76",
    voltage: 1.35,
    ecc: false,
    heat_spreader: true,
    rgb: false,
    color: ["Black"],
    ...overrides,
  };
  return makeProduct("Corsair Vengeance 32GB DDR5-6000", "ram", "RAM", "Corsair", specs, quantity);
}

export function makeGpu(overrides: Overrides<GpuSpecs> = {}): BuildProduct {
  const specs: GpuSpecs = {
    manufacturer: "MSI",
    chipset_manufacturer: "NVIDIA",
    chipset: "GeForce RTX 5070",
    architecture: null, // intencional: prueba que se infiere
    memory_gb: 12,
    memory_type: "GDDR7",
    core_base_clock_mhz: 2325,
    core_boost_clock_mhz: 2512,
    core_count: 6144,
    memory_clock_mhz: 28000,
    memory_bus_bit: 192,
    interface: "PCIe 5.0 x16",
    length_mm: 304,
    tdp_w: 250,
    cooling: "3 Fans",
    slots: 2,
    frame_sync: "G-Sync",
    color: ["Black"],
    power_connectors: { pcie_6_pin: 0, pcie_8_pin: 0, pcie_12vhpwr: 1 },
    video_ports: { hdmi: 1, displayport: 3, dvi: 0, vga: 0 },
    ...overrides,
  };
  return makeProduct("MSI RTX 5070 Ventus 12GB", "gpu", "GPU", "MSI", specs);
}

export function makePsu(overrides: Overrides<PsuSpecs> = {}): BuildProduct {
  const specs: PsuSpecs = {
    manufacturer: "Corsair",
    wattage: 750,
    form_factor: "ATX",
    efficiency_rating: "80+ Gold",
    modular: "Full",
    fanless: false,
    connectors: {
      atx_24_pin: 1,
      eps_8_pin: 2,
      pcie_12vhpwr: 1,
      pcie_6_plus_2_pin: 4,
      sata: 6,
      molex: 4,
    },
    color: ["Black"],
    length_mm: 160,
    ...overrides,
  };
  return makeProduct("Corsair RM750x 750W", "psu", "PSU", "Corsair", specs);
}

export function makeCase(overrides: Overrides<CaseSpecs> = {}): BuildProduct {
  const specs: CaseSpecs = {
    manufacturer: "Corsair",
    form_factor: "ATX Mid Tower",
    supported_motherboard_form_factors: ["ATX", "Micro ATX", "Mini ITX"],
    side_panel: "Tempered Glass",
    color: ["Black"],
    dimensions_mm: { width: 230, height: 480, depth: 480 },
    max_gpu_length_mm: 400,
    max_cpu_cooler_height_mm: 170,
    drive_bays: { internal_3_5: 2, internal_2_5: 2 },
    expansion_slots: 7,
    front_ports: ["USB-C", "USB-A", "Audio"],
    included_fans: 3,
    ...overrides,
  };
  return makeProduct("Corsair 480T", "case", "Case", "Corsair", specs);
}

export function makeAioCooler(overrides: Overrides<CpuCoolerSpecs> = {}): BuildProduct {
  const specs: CpuCoolerSpecs = {
    manufacturer: "Esgaming",
    type: "AIO",
    height_mm: null, // AIO no tiene altura útil
    fan_rpm: { min: 600, max: 2200 },
    noise_level_db: { min: 18, max: 35 },
    water_cooled: true,
    radiator_size_mm: 240,
    fan_size_mm: 120,
    color: ["Black"],
    sockets: ["AM5", "AM4", "LGA1700"],
    ...overrides,
  };
  return makeProduct("Esgaming AIO 240mm", "cpu-cooler", "CPU Cooler", "Esgaming", specs);
}

export function makeAirCooler(overrides: Overrides<CpuCoolerSpecs> = {}): BuildProduct {
  const specs: CpuCoolerSpecs = {
    manufacturer: "Noctua",
    type: "Air",
    height_mm: 165,
    fan_rpm: { min: 300, max: 1500 },
    noise_level_db: { min: 14, max: 24 },
    water_cooled: false,
    radiator_size_mm: null,
    fan_size_mm: 140,
    color: ["Brown"],
    sockets: ["AM5", "AM4", "LGA1700"],
    ...overrides,
  };
  return makeProduct("Noctua NH-D15", "cpu-cooler", "CPU Cooler", "Noctua", specs);
}

export function makeSataSsd(overrides: Overrides<StorageSpecs> = {}): BuildProduct {
  const specs: StorageSpecs = {
    manufacturer: "Crucial",
    type: "SSD",
    capacity_gb: 1000,
    interface: "SATA III",
    form_factor: '2.5"',
    cache_mb: null,
    rpm: null,
    nvme: false,
    read_speed_mb_s: 540,
    write_speed_mb_s: 500,
    ...overrides,
  };
  return makeProduct("Crucial BX500 1TB", "ssd", "SSD", "Crucial", specs);
}

export function makeNvmeSsd(overrides: Overrides<StorageSpecs> = {}): BuildProduct {
  const specs: StorageSpecs = {
    manufacturer: "Samsung",
    type: "SSD",
    capacity_gb: 1000,
    interface: "PCIe 4.0 x4",
    form_factor: "M.2-2280",
    cache_mb: 1024,
    rpm: null,
    nvme: true,
    read_speed_mb_s: 7000,
    write_speed_mb_s: 5000,
    ...overrides,
  };
  return makeProduct("Samsung 980 Pro 1TB", "ssd", "SSD", "Samsung", specs);
}

export function makeHdd(overrides: Overrides<StorageSpecs> = {}): BuildProduct {
  const specs: StorageSpecs = {
    manufacturer: "Seagate",
    type: "HDD",
    capacity_gb: 2000,
    interface: "SATA III",
    form_factor: '3.5"',
    cache_mb: 256,
    rpm: 7200,
    nvme: false,
    read_speed_mb_s: null,
    write_speed_mb_s: null,
    ...overrides,
  };
  return makeProduct("Seagate Barracuda 2TB", "hdd", "HDD", "Seagate", specs);
}

/**
 * Build "completo" típico para tests positivos.
 */
export function makeFullValidBuild() {
  return {
    cpu: makeCpu(),
    motherboard: makeMobo(),
    ram: makeRam(),
    gpu: makeGpu(),
    psu: makePsu(),
    case: makeCase(),
    "cpu-cooler": makeAioCooler(),
    ssd: makeSataSsd(),
  };
}
