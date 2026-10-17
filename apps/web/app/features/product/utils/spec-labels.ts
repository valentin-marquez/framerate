import type { ProductSpec } from "@framerate/contracts";

/** Etiqueta y unidad de cada campo de `SPEC_FIELDS` (contracts/normalization.ts). Un campo sin etiqueta no se muestra. */
const SPECS: Record<string, [label: string, unit?: string]> = {
  // GPU
  memory_type: ["Tipo de memoria"],
  memory_bus_bit: ["Bus de memoria", "bits"],
  core_boost_clock_mhz: ["Frecuencia boost", "MHz"],
  tdp_w: ["Consumo (TDP)", "W"],
  length_mm: ["Largo", "mm"],
  slots: ["Ranuras que ocupa"],
  hdmi: ["Puertos HDMI"],
  displayport: ["Puertos DisplayPort"],
  power_connectors: ["Conectores de energía"],
  // CPU
  socket: ["Socket"],
  cores_total: ["Núcleos"],
  cores_performance: ["Núcleos de rendimiento"],
  cores_efficiency: ["Núcleos de eficiencia"],
  threads: ["Hilos"],
  base_ghz: ["Frecuencia base", "GHz"],
  boost_ghz: ["Frecuencia turbo", "GHz"],
  l3_mb: ["Caché L3", "MB"],
  integrated_graphics: ["Gráficos integrados"],
  includes_cooler: ["Incluye disipador"],
  memory_types: ["Memoria compatible"],
  // Placa madre
  memory_slots: ["Ranuras de memoria"],
  memory_max_gb: ["Memoria máxima", "GB"],
  memory_max_speed_mt_s: ["Velocidad máxima de memoria", "MT/s"],
  m2_slots: ["Ranuras M.2"],
  pcie_x16_slots: ["Ranuras PCIe x16"],
  sata_ports: ["Puertos SATA"],
  wifi_standard: ["Wi-Fi"],
  ethernet: ["Red cableada"],
  // RAM
  timings: ["Latencias"],
  voltage: ["Voltaje", "V"],
  heat_spreader: ["Disipador"],
  xmp_expo: ["Perfil XMP/EXPO"],
  // Fuente
  atx_version: ["Versión ATX"],
  fanless: ["Sin ventilador"],
  pcie_12vhpwr: ["Conector 12VHPWR"],
  pcie_6_plus_2_pin: ["Conectores PCIe 6+2"],
  sata_connectors: ["Conectores SATA"],
  // Almacenamiento
  read_speed_mb_s: ["Lectura", "MB/s"],
  write_speed_mb_s: ["Escritura", "MB/s"],
  nand_type: ["Tipo de NAND"],
  dram_cache: ["Caché DRAM"],
  tbw: ["Durabilidad", "TBW"],
  controller: ["Controlador"],
  cache_mb: ["Caché", "MB"],
  usage: ["Uso"],
  // Refrigeración y gabinete
  height_mm: ["Altura", "mm"],
  fan_size_mm: ["Ventilador", "mm"],
  fan_count: ["Ventiladores"],
  tdp_rating_w: ["Disipa hasta", "W"],
  sockets: ["Sockets compatibles"],
  supported_motherboard_form_factors: ["Placas compatibles"],
  side_panel: ["Panel lateral"],
  max_gpu_length_mm: ["Tarjeta de video de hasta", "mm"],
  max_cpu_cooler_height_mm: ["Disipador de hasta", "mm"],
  included_fans: ["Ventiladores incluidos"],
  radiator_support_mm: ["Radiadores compatibles", "mm"],
  front_ports: ["Puertos frontales"],
  rpm_max: ["Velocidad máxima", "RPM"],
  airflow_cfm_max: ["Flujo de aire", "CFM"],
  pwm: ["Control PWM"],
  static_pressure_mmh2o: ["Presión estática", "mmH2O"],
  noise_dba_max: ["Ruido máximo", "dBA"],
  bearing: ["Rodamiento"],
  lighting: ["Iluminación"],
  fan_controller: ["Necesita controlador"],
};

// Los códigos que escribe la referencia de ventiladores (#181); lo que no está aquí se muestra tal cual.
const VALUES: Record<string, string> = {
  fdb: "Fluido dinámico (FDB)",
  lcp_fdb: "Fluido dinámico (FDB)",
  hydraulic: "Hidráulico",
  rifle: "Rifle",
  sleeve: "Manga",
  ball: "Bolas",
  dual_ball: "Doble rodamiento de bolas",
  maglev: "Levitación magnética",
  none: "Sin iluminación",
  rgb_12v: "RGB 12 V (4 pines)",
  argb_5v: "ARGB 5 V (3 pines)",
  proprietary: "Propietaria",
  led_fixed: "LED de un color",
  "magnetic dome": "Domo magnético",
};

const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

export interface SpecRow {
  label: string;
  value: string;
  knowledge: boolean;
}

/** Las specs de la ficha como filas legibles: sí/no, número con unidad, texto tal cual. */
export function specLines(specs: readonly ProductSpec[]): SpecRow[] {
  return specs.flatMap(({ key, value, knowledge }) => {
    const spec = SPECS[key];
    if (!spec) return [];
    const [label, unit] = spec;
    const text =
      typeof value === "boolean"
        ? value
          ? "Sí"
          : "No"
        : typeof value === "number"
          ? `${number.format(value)}${unit ? ` ${unit}` : ""}`
          : (VALUES[value] ?? value);
    return [{ label, value: text, knowledge }];
  });
}
