/**
 * Procesador de GPU
 * Normaliza y extrae especificaciones de tarjetas gráficas desde diferentes fuentes (PC Express, SP Digital, Título).
 */

import type { GpuSpecs } from "@framerate/db";
import { GpuNormalizer } from "./normalizers/gpu";

function parseBoolean(value?: string): boolean {
	if (!value) return false;
	const normalized = value.toLowerCase().trim();
	return (
		normalized === "sí" ||
		normalized === "si" ||
		normalized === "yes" ||
		normalized === "true"
	);
}

function parseList(value?: string): string[] {
	if (!value) return [];
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function extractMemoryFromTitle(title: string): string {
	// Coincidir patrones como "32GB", "16 GB", "8G GDDR7", "12GB GDDR6X"
	const match = title.match(/(\d{1,2})\s*G(?:B)?\s*(GDDR\d+X?)?/i);
	if (match) {
		const size = match[1];
		const type = match[2]?.toUpperCase() || "";
		return type ? `${size} GB ${type}` : `${size} GB`;
	}
	return "";
}

function extractGpuModelFromTitle(title: string): string {
	const chip = GpuNormalizer.detectChip(title);
	if (!chip) return "";

	if (chip.manufacturer === "NVIDIA") {
		if (chip.series === "RTX A") {
			return `NVIDIA RTX A${chip.model}`;
		}
		// GT, GTX, RTX
		const prefix = chip.series.split(" ")[0]; // RTX, GTX, GT
		let variant = "";
		if (chip.variant) {
			variant = chip.variant === "TI" ? " Ti" : " Super";
		}
		return `NVIDIA GeForce ${prefix} ${chip.model}${variant}`;
	}

	if (chip.manufacturer === "AMD") {
		let variant = "";
		if (chip.variant) {
			variant =
				chip.variant === "XT" ? " XT" : chip.variant === "XTX" ? " XTX" : "";
		}
		return `AMD Radeon RX ${chip.model}${variant}`;
	}

	if (chip.manufacturer === "Intel") {
		return `Intel Arc ${chip.model}`;
	}

	return "";
}

function extractManufacturerFromTitle(title: string): string {
	const titleUpper = title.toUpperCase();

	if (
		titleUpper.includes("RTX") ||
		titleUpper.includes("GTX") ||
		titleUpper.includes("GEFORCE") ||
		titleUpper.includes("QUADRO") ||
		titleUpper.match(/\bGT\s*\d{3,4}\b/)
	) {
		return "NVIDIA";
	}

	if (
		titleUpper.includes("RADEON") ||
		titleUpper.match(/\bRX\s*\d{4}\b/) ||
		titleUpper.match(/\bRX\s*\d{3}\b/)
	) {
		return "AMD";
	}

	if (titleUpper.includes("ARC") || titleUpper.includes("INTEL")) {
		return "Intel";
	}

	return "";
}

function extractBusFromTitle(title: string): string {
	const titleUpper = title.toUpperCase();

	// Handle various formats: "PCIe 5.0", "PCI-e 5.0", "PCI Express 5.0", "PCIEX 5.0"
	if (
		titleUpper.includes("PCIE 5") ||
		titleUpper.includes("PCI-E 5") ||
		titleUpper.includes("PCIEX 5") ||
		titleUpper.includes("PCI EXPRESS 5")
	) {
		return "PCI Express 5.0";
	}
	if (
		titleUpper.includes("PCIE 4") ||
		titleUpper.includes("PCI-E 4") ||
		titleUpper.includes("PCIEX 4") ||
		titleUpper.includes("PCI EXPRESS 4")
	) {
		return "PCI Express 4.0";
	}
	if (
		titleUpper.includes("PCIE 3") ||
		titleUpper.includes("PCI-E 3") ||
		titleUpper.includes("PCIEX 3") ||
		titleUpper.includes("PCI EXPRESS 3")
	) {
		return "PCI Express 3.0";
	}

	return "";
}

/**
 * Construye array de video_ports desde especificaciones de SP Digital
 */
function buildVideoPortsFromSpDigital(
	rawSpecs: Record<string, string>,
): string[] {
	const ports: string[] = [];

	// HDMI
	const hdmiCount =
		rawSpecs["Número de puertos HDMI"] ||
		rawSpecs["Cantidad de puertos HDMI"] ||
		"";
	const hdmiVersion = rawSpecs["Versión HDMI"] || "";
	if (hdmiCount && hdmiCount !== "0") {
		ports.push(`${hdmiCount}x HDMI${hdmiVersion ? ` ${hdmiVersion}` : ""}`);
	}

	// DisplayPort
	const dpCount =
		rawSpecs["Cantidad de DisplayPorts"] ||
		rawSpecs["Número de DisplayPorts"] ||
		"";
	const dpVersion = rawSpecs["Versión de DisplayPort"] || "";
	if (dpCount && dpCount !== "0") {
		ports.push(`${dpCount}x DisplayPort${dpVersion ? ` ${dpVersion}` : ""}`);
	}

	// Mini DisplayPort
	const miniDpCount = rawSpecs["Cantidad de Mini DisplayPorts"] || "";
	if (miniDpCount && miniDpCount !== "0") {
		ports.push(`${miniDpCount}x Mini DisplayPort`);
	}

	// DVI-D
	const dviDCount = rawSpecs["Cantidad de puertos DVI-D"] || "";
	if (dviDCount && dviDCount !== "0") {
		ports.push(`${dviDCount}x DVI-D`);
	}

	// DVI-I
	const dviICount = rawSpecs["Cantidad de puertos DVI-I"] || "";
	if (dviICount && dviICount !== "0") {
		ports.push(`${dviICount}x DVI-I`);
	}

	return ports;
}

/**
 * Construye string de memoria desde especificaciones de SP Digital
 * Ejemplo: "16 GB GDDR6 (256 bit)"
 */
function buildMemoryFromSpDigital(rawSpecs: Record<string, string>): string {
	const capacity = rawSpecs["Capacidad memoria de adaptador gráfico"] || "";
	const type = rawSpecs["Tipo de memoria de adaptador gráfico"] || "";
	const busWidth = rawSpecs["Ancho de datos"] || "";

	if (!capacity) return "";

	let memory = capacity;
	if (type) {
		memory += ` ${type}`;
	}
	if (busWidth) {
		memory += ` (${busWidth})`;
	}

	return memory;
}

/**
 * Construye string de refrigeración desde especificaciones de SP Digital
 */
function buildCoolingFromSpDigital(rawSpecs: Record<string, string>): string {
	const coolingType = rawSpecs["Tipo de enfriamiento"] || "";
	const coolingTech =
		rawSpecs["Tecnología  de enfriamiento"] ||
		rawSpecs["Tecnología de enfriamiento"] ||
		"";
	const numFans = rawSpecs["Número de ventiladores"] || "";

	const parts: string[] = [];

	if (coolingType) {
		parts.push(coolingType);
	}
	if (numFans) {
		parts.push(numFans);
	}
	if (coolingTech && coolingTech !== coolingType) {
		parts.push(`(${coolingTech})`);
	}

	return parts.join(" ") || "";
}

/**
 * Mapea formato de slots de SP Digital
 * "2,5" -> "2.5 slot"
 */
function mapSlotsFromSpDigital(value: string): string {
	if (!value) return "";
	// Replace comma with dot for decimal
	const normalized = value.replace(",", ".");
	// Check if it's a number
	const num = Number.parseFloat(normalized);
	if (!Number.isNaN(num)) {
		return num === 1 ? "Single slot" : `${num} slot`;
	}
	return value;
}

/**
 * Mapea perfil de SP Digital desde factor de forma
 */
function mapProfileFromSpDigital(rawSpecs: Record<string, string>): string {
	const formFactor = rawSpecs["Factor de forma"] || "";
	const bracketHeight = rawSpecs["Altura del soporte"] || "";

	if (formFactor.includes("Low Profile") || formFactor.includes("LP")) {
		return "Low Profile";
	}
	if (bracketHeight.includes("Low")) {
		return "Low Profile";
	}
	if (formFactor.includes("Full-Height") || bracketHeight.includes("Full")) {
		return "Normal";
	}

	return "";
}

/**
 * Construye string de frecuencias desde especificaciones de SP Digital
 * Usa "Aumento de la velocidad de reloj del procesador" como reloj boost
 */
function buildFrequenciesFromSpDigital(
	rawSpecs: Record<string, string>,
): string {
	const boostClock =
		rawSpecs["Aumento de la velocidad de reloj del procesador"] || "";

	if (boostClock) {
		return `Boost: ${boostClock}`;
	}

	return "";
}

export const GpuProcessor = {
	normalize(rawSpecs: Record<string, string>, title = ""): GpuSpecs {
		// Determinar si son datos de SP Digital revisando campos específicos
		const isSpDigital =
			rawSpecs["Familia de procesadores de gráficos"] !== undefined ||
			rawSpecs["Procesador gráfico"] !== undefined ||
			rawSpecs["Capacidad memoria de adaptador gráfico"] !== undefined ||
			rawSpecs["Tipo de interfaz"] !== undefined;

		// Determinar si son datos de PC Express
		const isPcExpress =
			rawSpecs.Fabricante !== undefined ||
			rawSpecs.GPU !== undefined ||
			rawSpecs.Memoria !== undefined;

		if (isSpDigital) {
			return this.normalizeSpDigital(rawSpecs, title);
		}

		if (isPcExpress) {
			return this.normalizePcExpress(rawSpecs);
		}

		// No hay especificaciones disponibles, extraer solo del título
		return this.normalizeFromTitleOnly(title);
	},

	/**
	 * Normalizar cuando solo el título está disponible (sin especificaciones)
	 */
	normalizeFromTitleOnly(title: string): GpuSpecs {
		const gpuModel = extractGpuModelFromTitle(title);
		const manufacturer = extractManufacturerFromTitle(title);
		const memory = extractMemoryFromTitle(title);
		const bus = extractBusFromTitle(title);

		return {
			manufacturer,
			gpu_model: gpuModel,
			memory,
			bus,
			frequencies: "",
			memory_frequency: "",
			core: "",
			profile: "",
			cooling: "",
			slots: "",
			length: "",
			illumination: "",
			backplate: false,
			power_connectors: [],
			video_ports: [],
		};
	},

	/**
	 * Normalizar especificaciones desde formato PC Express
	 */
	normalizePcExpress(rawSpecs: Record<string, string>): GpuSpecs {
		return {
			manufacturer: rawSpecs.Fabricante || "",
			gpu_model: rawSpecs.GPU || "",
			memory: rawSpecs.Memoria || "",
			bus: rawSpecs.Bus || "",
			frequencies: rawSpecs["Frecuencias core (base / boost / OC)"] || "",
			memory_frequency: rawSpecs["Frecuencia memorias"] || "",
			core: rawSpecs.Núcleo || "",
			profile: rawSpecs.Perfil || "",
			cooling: rawSpecs.Refrigeración || "",
			slots: rawSpecs.Slots || "",
			length: rawSpecs.Largo || "",
			illumination: rawSpecs.Iluminación || "",
			backplate: parseBoolean(rawSpecs["¿Backplate?"]),
			power_connectors: parseList(rawSpecs["Conectores de poder"]),
			video_ports: parseList(rawSpecs["Puertos de video"]),
		};
	},

	/**
	 * Normalizar especificaciones desde formato SP Digital
	 */
	normalizeSpDigital(
		rawSpecs: Record<string, string>,
		title: string,
	): GpuSpecs {
		// Fabricante de GPU (NVIDIA, AMD, Intel)
		const spManufacturer =
			rawSpecs["Familia de procesadores de gráficos"] || "";
		const manufacturer = spManufacturer || extractManufacturerFromTitle(title);

		// Modelo de GPU (ej. "Radeon RX 9070 XT", "GeForce RTX 5060")
		const spGpuModel = rawSpecs["Procesador gráfico"] || "";
		let gpuModel = "";
		if (spGpuModel) {
			// Combinar fabricante con modelo para nombre completo
			if (manufacturer === "AMD" && !spGpuModel.includes("Radeon")) {
				gpuModel = `AMD Radeon ${spGpuModel}`;
			} else if (manufacturer === "NVIDIA" && !spGpuModel.includes("GeForce")) {
				gpuModel = `NVIDIA GeForce ${spGpuModel}`;
			} else if (manufacturer === "Intel" && !spGpuModel.includes("Arc")) {
				gpuModel = `Intel ${spGpuModel}`;
			} else {
				gpuModel = spGpuModel;
			}
		} else {
			gpuModel = extractGpuModelFromTitle(title);
		}

		// Memoria (capacidad + tipo + ancho de bus)
		const memory =
			buildMemoryFromSpDigital(rawSpecs) || extractMemoryFromTitle(title);

		// Interfaz de bus
		const spBus = rawSpecs["Tipo de interfaz"] || "";
		const bus = spBus || extractBusFromTitle(title);

		// Frecuencias
		const frequencies = buildFrequenciesFromSpDigital(rawSpecs);

		// Frecuencia de memoria (SP Digital usa "Velocidad de transferencia de datos")
		const memoryFrequency =
			rawSpecs["Velocidad de transferencia de datos"] || "";

		// Núcleo (no típicamente en especificaciones de SP Digital)
		const core = "";

		// Perfil (normal/perfil bajo)
		const profile = mapProfileFromSpDigital(rawSpecs);

		// Refrigeración
		const cooling = buildCoolingFromSpDigital(rawSpecs);

		// Slots
		const slotsRaw = rawSpecs["Número de ranuras"] || "";
		const slots = mapSlotsFromSpDigital(slotsRaw);

		// Largo
		const length = rawSpecs.Longitud || "";

		// Iluminación (no típicamente en especificaciones de SP Digital)
		const illumination = "";

		// Backplate (no en especificaciones de SP Digital)
		const backplate = false;

		// Conectores de poder
		const powerConnectorsRaw =
			rawSpecs["Conectores de energia suplementario"] || "";
		const powerConnectors = powerConnectorsRaw
			? parseList(powerConnectorsRaw.replace(/\s*,\s*/g, "\n"))
			: [];

		// Puertos de video
		const videoPorts = buildVideoPortsFromSpDigital(rawSpecs);

		// Revisar edición OC
		const isOc = parseBoolean(
			rawSpecs["Edición sobreacelerada (OC, Overclocked)"],
		);

		return {
			manufacturer,
			gpu_model:
				isOc && gpuModel && !gpuModel.includes("OC")
					? `${gpuModel} OC`
					: gpuModel,
			memory,
			bus,
			frequencies,
			memory_frequency: memoryFrequency,
			core,
			profile,
			cooling,
			slots,
			length,
			illumination,
			backplate,
			power_connectors: powerConnectors,
			video_ports: videoPorts,
		};
	},
};
