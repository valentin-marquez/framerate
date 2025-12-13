export interface GpuSpecs {
	manufacturer: string; // ej. "MSI"
	gpu_model: string; // ej. "NVIDIA GeForce RTX 5060"
	memory: string; // ej. "8 GB GDDR7 (128 bit)"
	bus: string; // ej. "PCI Express 5.0 x8"
	frequencies: string; // ej. "2280 / 2497 / 2535 MHz"
	memory_frequency: string; // ej. "875 MHz"
	core: string; // ej. "NVIDIA Blackwell 2.0 GB206-250"
	profile: string; // ej. "Normal"
	cooling: string; // ej. "Ventilador"
	slots: string; // ej. "Dual slot"
	length: string; // ej. "197 mm"
	illumination: string; // ej. "No posee"
	backplate: boolean; // ej. true
	power_connectors: string[]; // ej. ["1x 8 pines"]
	video_ports: string[]; // ej. ["3x DisplayPort 2.1", "1x HDMI 2.1b"]
}

export interface CpuSpecs {
	manufacturer: string; // ej. "AMD", "Intel"
	// Especificaciones principales
	frequency: string; // ej. "3.4 GHz"
	frequency_turbo: string; // ej. "5.7 GHz"
	cores_threads: string; // ej. "8 núcleos / 16 hilos"
	cache: string; // ej. "32 MB L3"
	socket: string; // ej. "AM5", "LGA1700"
	// Especificaciones secundarias
	core_name: string; // ej. "Zen 5", "Raptor Lake"
	manufacturing_process: string; // ej. "4nm", "7nm"
	tdp: string; // ej. "65W", "125W"
	cooler_included: boolean; // ej. true
	integrated_graphics: string; // ej. "AMD Radeon Graphics", "Intel UHD 770", "No posee"
}

export interface PsuSpecs {
	manufacturer: string; // ej. "Corsair", "EVGA", "Seasonic"
	// Especificaciones principales
	wattage: string; // ej. "550W", "750W", "1000W"
	certification: string; // ej. "80 Plus Bronze", "80 Plus Gold", "80 Plus Platinum"
	form_factor: string; // ej. "ATX", "SFX", "SFX-L"
	pfc_active: boolean; // Corrección de Factor de Potencia activa
	modular: string; // ej. "Full Modular", "Semi Modular", "No"
	// Especificaciones secundarias - Corrientes de riel
	rail_12v: string; // ej. "54.2 A"
	rail_5v: string; // ej. "20 A"
	rail_3v3: string; // ej. "20 A"
	// Conectores
	power_connectors: string[]; // ej. ["1x 16 pines (12VHPWR)", "1x 20+4 pines (Motherboard)", "2x 4+4 pines (CPU)"]
}

export interface MotherboardSpecs {
	manufacturer: string; // ej. "ASUS", "Gigabyte", "MSI"
	// Especificaciones principales
	socket: string; // ej. "LGA 1700", "AM4", "AM5"
	chipset: string; // ej. "Intel B760 (LGA 1700)", "AMD B550 (AM4)"
	memory_slots: string; // ej. "2x DDR4", "4x DDR5"
	memory_channels: string; // ej. "Dual channel", "Quad channel"
	form_factor: string; // ej. "ATX", "Micro ATX", "Mini ITX"
	rgb_support: string[]; // ej. ["2x ARGB Programable (3-pin / 5V)", "1x RGB Simple (4-pin / 12V)"]
	video_ports: string[]; // ej. ["1x HDMI", "1x VGA", "1x DisplayPort"]
	power_connectors: string[]; // ej. ["1x 24 pines (Motherboard)", "1x 8 pines (CPU)"]
	// Especificaciones secundarias
	integrated_graphics: string; // ej. "Redirige gráficos del procesador", "No"
	sli_support: boolean; // ej. false
	crossfire_support: boolean; // ej. false
	raid_support: boolean; // ej. true
	storage_connectors: string[]; // ej. ["2x M.2 2280 (PCIe 4.0 x4)", "4x SATA (SATA 3)"]
	io_ports: string[]; // ej. ["1x PS/2", "1x RJ45", "4x USB 3.2 Gen 1"]
	expansion_slots: string[]; // ej. ["2x PCI Express 4.0 x1", "1x PCI Express 4.0 x16"]
}

export interface CaseSpecs {
	manufacturer: string; // ej. "Gamemax", "Corsair", "NZXT"
	// Especificaciones principales
	max_motherboard_size: string; // ej. "ATX", "Micro ATX", "Mini ITX"
	psu_included: string; // ej. "No posee", "500W"
	side_panel: string; // ej. "Vidrio templado", "Acrílico", "Sólido"
	color: string; // ej. "Negro", "Blanco"
	illumination: string; // ej. "RGB", "ARGB", "No"
	dimensions: string; // ej. "358 x 373 x 275 mm"
	max_gpu_length: string; // ej. "330 mm"
	max_cooler_height: string; // ej. "155 mm"
	// Especificaciones secundarias
	weight: string; // ej. "5.5 kg"
	psu_position: string; // ej. "Inferior", "Lateral", "Superior"
	expansion_slots: string; // ej. "7", "4"
	front_ports: string[]; // ej. ["2x USB 2.0", "1x USB 3.0", "1x USB-C"]
	drive_bays: string[]; // ej. ["5¼ externas: 0", "3½ internas: 2", "2½ internas: 4"]
	// Ventilación
	front_fans: string; // ej. "3 x 120 mm", "No posee"
	rear_fans: string; // ej. "1 x 120 mm"
	side_fans: string; // ej. "2 x 120 mm", "No posee"
	top_fans: string; // ej. "2 x 120 mm / 2 x 140 mm"
	bottom_fans: string; // ej. "2 x 120 mm", "No posee"
	included_fans: string; // ej. "3x 120mm ARGB", "No posee"
}

export interface RamSpecs {
	manufacturer: string; // ej. "Kingston", "Corsair", "G.Skill"
	// Especificaciones principales
	capacity: string; // ej. "1 x 16 GB", "2 x 8 GB"
	type: string; // ej. "DDR4", "DDR5"
	speed: string; // ej. "3200 MT/s", "6000 MT/s"
	format: string; // ej. "DIMM", "SO-DIMM"
	// Especificaciones secundarias
	voltage: string; // ej. "1.35 V", "1.1 V"
	latency_cl: string; // ej. "16", "19"
	latency_trcd: string; // ej. "20", "Desconocida"
	latency_trp: string; // ej. "20", "Desconocida"
	latency_tras: string; // ej. "40", "Desconocida"
	ecc_support: boolean; // ej. false
	full_buffered: boolean; // ej. false
}

export interface HddSpecs {
	manufacturer: string; // ej. "Western Digital", "Seagate", "Hitachi"
	// Especificaciones principales
	type: string; // ej. "HDD"
	line: string; // ej. "WD Gold", "Seagate Skyhawk", "Hitachi Ultrastar"
	capacity: string; // ej. "2 TB", "8 TB"
	rpm: string; // ej. "7200 rpm", "5400 rpm"
	size: string; // ej. "3.5\"", "2.5\""
	bus: string; // ej. "SATA 3 (6.0 Gb/s)", "SATA 2"
	buffer: string; // ej. "64 MB", "128 MB", "256 MB"
}

export interface SsdSpecs {
	manufacturer: string; // ej. "Kingston", "Samsung", "Western Digital"
	// Especificaciones principales
	line: string; // ej. "Kingston A400", "Samsung 980 Pro", "WD Black SN850X"
	capacity: string; // ej. "480 GB", "1 TB", "2 TB"
	format: string; // ej. "2.5\"", "M.2 2280", "M.2 2230", "U.2"
	bus: string; // ej. "SATA 3 (6.0 Gb/s)", "PCIe 4.0 NVMe", "PCIe 5.0 NVMe"
	has_dram: boolean; // ej. true, false
	nand_type: string; // ej. "TLC", "QLC", "MLC"
	controller: string; // ej. "Phison S11", "Samsung Elpis"
	// Rendimiento
	read_speed: string; // ej. "500 MB/s", "7000 MB/s"
	write_speed: string; // ej. "450 MB/s", "6000 MB/s"
}

export interface CaseFanSpecs {
	manufacturer: string; // ej. "Cooler Master", "Antec", "Gamemax", "XPG"
	// Especificaciones principales
	size: string; // ej. "120 mm", "140 mm", "80 mm"
	rpm: string; // ej. "3000 RPM", "1800 RPM", "500-2000 RPM"
	airflow: string; // ej. "77 CFM", "62 CFM"
	static_pressure: string; // ej. "6.9 mm H2O", "2.5 mm H2O"
	noise_level: string; // ej. "28 dBA", "35 dBA", "Desconocido"
	// Características
	illumination: string; // ej. "RGB", "ARGB", "No"
	lighting_control: string; // ej. "Addressable RGB", "Software", "No posee"
	bearing: string; // ej. "Fluid Dynamic Bearing", "Sleeve Bearing", "Ball Bearing"
	// Información del paquete
	fans_included: string; // ej. "1", "3", "5"
	includes_hub: boolean; // ej. true, false
	// Conectores
	power_connectors: string[]; // ej. ["4 pin PWM", "3 pin"], ["ARGB 5V 3-pin"]
}

export interface CpuCoolerSpecs {
	manufacturer: string; // ej. "Thermalright", "Noctua", "Cooler Master", "MSI"
	// Especificaciones principales
	type: string; // ej. "Ventilador", "Refrigeración líquida"
	fan_size: string; // ej. "120 mm", "140 mm", "240 mm", "360 mm" (radiator size for AIO)
	height: string; // ej. "155 mm", "71 mm"
	weight: string; // ej. "730 g", "Desconocido"
	// Rendimiento
	rpm: string; // ej. "1550 rpm", "500 - 2050 rpm"
	airflow: string; // ej. "66.17 CFM", "64.89 CFM"
	noise_level: string; // ej. "25.6 dB", "Desconocido"
	// Características
	has_heatpipes: boolean; // ej. true, false
	illumination: string; // ej. "RGB", "ARGB", "No"
	// Compatibilidad
	compatible_sockets: string[]; // ej. ["AM4", "AM5", "LGA 1700", "LGA 1851"]
}

// Unión de tipos para todas las especificaciones de categoría
export type ProductSpecs =
	| GpuSpecs
	| CpuSpecs
	| PsuSpecs
	| MotherboardSpecs
	| CaseSpecs
	| RamSpecs
	| HddSpecs
	| SsdSpecs
	| CaseFanSpecs
	| CpuCoolerSpecs;
