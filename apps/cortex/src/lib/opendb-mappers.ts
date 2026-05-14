/**
 * Mappers determinísticos de OpenDB → Zod spec schemas.
 * Cuando OpenDB matchea por MPN exacto, estos mappers permiten
 * saltarse el LLM completamente y usar los datos curados de OpenDB.
 *
 * Todos los campos de los schemas son nullable/optional, así que
 * un mapping parcial es perfectamente válido.
 */
import type { OpenDBItem } from "./opendb";

type AnySpecs = Record<string, unknown>;

// ─── GPU ────────────────────────────────────────────────────────
function mapGpu(item: OpenDBItem): AnySpecs {
  const vo = item.video_outputs as Record<string, number> | undefined;
  const pc = item.power_connectors as Record<string, number> | undefined;

  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    chipset_manufacturer: item.chipset_manufacturer ?? null,
    chipset: item.chipset ?? null,
    architecture: item.architecture ?? null,
    memory_gb: item.memory ?? null,
    memory_type: item.memory_type ?? null,
    core_base_clock_mhz: item.core_base_clock ?? null,
    core_boost_clock_mhz: item.core_boost_clock ?? null,
    core_count: item.core_count ?? null,
    memory_clock_mhz: item.effective_memory_clock ?? null,
    memory_bus_bit: item.memory_bus || null,
    interface: item.interface ?? null,
    length_mm: item.length ?? null,
    tdp_w: item.tdp ?? null,
    cooling: item.cooling ?? null,
    slots: item.total_slot_width ?? null,
    frame_sync: item.frame_sync ?? null,
    color: item.color ?? null,
    power_connectors: pc
      ? {
          pcie_6_pin: pc.pcie_6_pin ?? null,
          pcie_8_pin: pc.pcie_8_pin ?? null,
          pcie_12vhpwr: pc.pcie_12VHPWR ?? pc.pcie_12vhpwr ?? pc.pcie_12V_2x6 ?? null,
        }
      : null,
    video_ports: vo
      ? {
          hdmi: sum(vo.hdmi_2_1, vo.hdmi_2_0, vo.hdmi_1_4) || null,
          displayport: sum(vo.displayport_2_1, vo.displayport_2_1a, vo.displayport_1_4a, vo.displayport_1_4) || null,
          dvi: sum(vo.dvi_d, vo.dvi_i) || null,
          vga: vo.vga ?? null,
        }
      : null,
  };
}

// ─── CPU ────────────────────────────────────────────────────────
function mapCpu(item: OpenDBItem): AnySpecs {
  const specs = (item.specifications ?? {}) as Record<string, unknown>;
  const memory = specs.memory as Record<string, unknown> | undefined;
  const ig = specs.integratedGraphics as Record<string, unknown> | undefined;
  const clocks = item.clocks as Record<string, Record<string, number>> | undefined;
  const cores = item.cores as Record<string, number> | undefined;
  const cache = item.cache as Record<string, unknown> | undefined;

  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    series: item.series ?? item.metadata?.series ?? null,
    microarchitecture: item.microarchitecture ?? null,
    socket: item.socket ?? null,
    cores: cores
      ? {
          total: cores.total ?? null,
          performance: cores.performance ?? null,
          efficiency: cores.efficiency ?? null,
          threads: cores.threads ?? null,
        }
      : null,
    clocks: clocks
      ? {
          base_ghz: clocks.performance?.base ?? clocks.base ?? null,
          boost_ghz: clocks.performance?.boost ?? clocks.boost ?? null,
        }
      : null,
    cache: cache
      ? {
          l1: cache.l1 != null ? String(cache.l1).trim() : null,
          l2_mb: cache.l2 ?? null,
          l3_mb: cache.l3 ?? null,
        }
      : null,
    tdp_w: (specs.tdp as number) ?? item.tdp ?? null,
    integrated_graphics: ig?.model && ig.model !== "None" ? ig.model : null,
    includes_cooler: (specs.includesCooler as boolean) ?? null,
    ecc_support: (specs.eccSupport as boolean) ?? null,
    lithography: (specs.lithography as string) ?? null,
    max_memory_gb: (memory?.maxSupport as number) ?? null,
    memory_types: (memory?.types as string[]) ?? null,
  };
}

// ─── RAM ────────────────────────────────────────────────────────
function mapRam(item: OpenDBItem): AnySpecs {
  const modules = item.modules as Record<string, number> | undefined;

  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    speed_mt_s: item.speed ?? null,
    type: item.ram_type ?? null,
    modules: modules ? { quantity: modules.quantity ?? null, capacity_gb: modules.capacity_gb ?? null } : null,
    total_capacity_gb: item.capacity ?? null,
    cas_latency: item.cas_latency ?? null,
    timings: item.timings ?? null,
    voltage: item.voltage ?? null,
    ecc: item.ecc === "ECC" ? true : item.ecc === "Non-ECC" ? false : null,
    heat_spreader: item.heat_spreader ?? null,
    rgb: item.rgb ?? null,
    color: item.color ?? null,
  };
}

// ─── Storage (SSD/HDD) ─────────────────────────────────────────
function mapStorage(item: OpenDBItem): AnySpecs {
  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    type: item.type ?? item.storage_type ?? null,
    capacity_gb: item.capacity ?? null,
    interface: item.interface ?? null,
    form_factor: item.form_factor ?? null,
    cache_mb: item.cache_mb ?? null,
    rpm: item.rpm ?? null,
    nvme: item.nvme ?? null,
    read_speed_mb_s: item.read_speed ?? null,
    write_speed_mb_s: item.write_speed ?? null,
  };
}

// ─── PSU ────────────────────────────────────────────────────────
function mapPsu(item: OpenDBItem): AnySpecs {
  const conn = item.connectors as Record<string, unknown> | undefined;
  const modularMap: Record<string, string> = {
    "Full-Modular": "Full",
    "Semi-Modular": "Semi",
    "Non-Modular": "No",
  };

  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    wattage: item.wattage ?? null,
    form_factor: item.form_factor ?? null,
    efficiency_rating: item.efficiency_rating ?? null,
    modular: modularMap[item.modular as string] ?? item.modular ?? null,
    fanless: item.fanless ?? null,
    connectors: conn
      ? {
          atx_24_pin: conn.atx_24_pin ?? null,
          eps_8_pin: conn.eps_8_pin ?? null,
          pcie_12vhpwr: conn.pcie_12vhpwr ?? null,
          pcie_6_plus_2_pin: conn.pcie_6_plus_2_pin ?? null,
          sata: conn.sata ?? null,
          molex: conn.molex_4_pin ?? conn.molex ?? null,
        }
      : null,
    color: item.color ?? null,
    length_mm: item.length ?? null,
  };
}

// ─── Motherboard ────────────────────────────────────────────────
function mapMotherboard(item: OpenDBItem): AnySpecs {
  const mem = item.memory as Record<string, unknown> | undefined;
  const ethernet = item.onboard_ethernet as Array<Record<string, string>> | undefined;

  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    socket: item.socket ?? null,
    form_factor: item.form_factor ?? null,
    chipset: item.chipset ?? null,
    memory: mem
      ? {
          max_gb: mem.max ?? null,
          type: mem.ram_type ?? null,
          slots: mem.slots ?? null,
        }
      : null,
    pcie_slots: item.pcie_slots ?? null,
    m2_slots: item.m2_slots ?? null,
    sata_ports: (item.storage_devices as Record<string, number>)?.sata_6_gb_s ?? null,
    onboard_ethernet: Array.isArray(ethernet) ? ethernet.map((e) => e.speed).filter(Boolean) : null,
    wireless_networking: item.wireless_networking ?? null,
    usb_headers: item.usb_headers ?? null,
    color: item.color ?? null,
  };
}

// ─── Case ───────────────────────────────────────────────────────
function mapCase(item: OpenDBItem): AnySpecs {
  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    form_factor: item.form_factor ?? null,
    supported_motherboard_form_factors: item.supported_motherboard_form_factors ?? null,
    side_panel: item.side_panel ?? null,
    color: item.color ?? null,
    dimensions_mm: item.dimensions_mm ?? null,
    max_gpu_length_mm: item.max_video_card_length ?? null,
    max_cpu_cooler_height_mm: item.max_cpu_cooler_height ?? null,
    drive_bays: {
      internal_3_5: item.internal_3_5_bays ?? null,
      internal_2_5: item.internal_2_5_bays ?? null,
    },
    expansion_slots: item.expansion_slots ?? null,
    front_ports: item.front_usb_ports ?? null,
    included_fans: item.included_fans ?? null,
  };
}

// ─── Case Fan ───────────────────────────────────────────────────
function mapCaseFan(item: OpenDBItem): AnySpecs {
  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    size_mm: item.size ?? null,
    quantity: item.quantity ?? null,
    rpm: null, // OpenDB stores min/max at top level, not nested
    airflow_cfm: {
      min: item.min_airflow ?? null,
      max: item.max_airflow ?? null,
    },
    noise_level_db: {
      min: item.min_noise_level ?? null,
      max: item.max_noise_level ?? null,
    },
    pwm: item.pwm ?? null,
    rgb: item.led != null && item.led !== "None" ? true : (item.rgb ?? null),
    static_pressure_mmh2o: item.static_pressure ?? null,
    color: item.color ?? null,
  };
}

// ─── CPU Cooler ─────────────────────────────────────────────────
function mapCpuCooler(item: OpenDBItem): AnySpecs {
  return {
    manufacturer: item.metadata?.manufacturer ?? null,
    type: item.water_cooled ? "AIO" : item.fanless ? "Fanless" : "Air",
    height_mm: item.height ?? null,
    fan_rpm: {
      min: item.min_fan_rpm ?? null,
      max: item.max_fan_rpm ?? null,
    },
    noise_level_db: {
      min: item.min_noise_level ?? null,
      max: item.max_noise_level ?? null,
    },
    water_cooled: item.water_cooled ?? null,
    radiator_size_mm: item.radiator_size ?? null,
    fan_size_mm: item.fan_size ?? null,
    color: item.color ?? null,
    sockets: item.cpu_sockets ?? null,
  };
}

// ─── Helpers ────────────────────────────────────────────────────
function sum(...vals: (number | undefined | null)[]): number {
  return vals.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

// ─── Public API ─────────────────────────────────────────────────
const MAPPERS: Record<string, (item: OpenDBItem) => AnySpecs> = {
  gpu: mapGpu,
  cpu: mapCpu,
  ram: mapRam,
  ssd: mapStorage,
  hdd: mapStorage,
  psu: mapPsu,
  motherboard: mapMotherboard,
  case: mapCase,
  "case-fan": mapCaseFan,
  case_fan: mapCaseFan,
  "cpu-cooler": mapCpuCooler,
  cpu_cooler: mapCpuCooler,
};

/**
 * Intenta mapear un item de OpenDB directamente al formato esperado por el Zod schema.
 * Retorna null si no hay mapper para la categoría.
 */
export function mapOpenDBToSpecs(category: string, item: OpenDBItem): AnySpecs | null {
  const mapper = MAPPERS[category.toLowerCase()];
  if (!mapper) return null;
  return mapper(item);
}
