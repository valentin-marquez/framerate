/**
 * Normalizador de Títulos de SSD
 * Normaliza los títulos de productos SSD a un formato consistente
 * Formato: "Marca Modelo Capacidad Formato [Bus]"
 * Ejemplo: "Samsung 990 Pro 2TB M.2 PCIe 4.0"
 */

import type { BrandModel } from "./types";
import { cleanHtmlEntities, extractCapacity } from "./utils";

/**
 * Detecta la línea de productos SSD de Western Digital desde el MPN
 * Patrones conocidos (soporta tanto G=GB como T=TB):
 * - WDS*G0A = Green (ej. WDS100T3G0A, WDS500G3G0A)
 * - WDS*B0A = Blue SATA (ej. WDS100T2B0A, WDS500G2B0A)
 * - WDS*B0B = Blue SN570 (ej. WDS100T3B0B)
 * - WDS*B0E = Blue SN580 (ej. WDS100T3B0E)
 * - WDBAUY* = Blue SN580
 * - WDS*X0E = Black SN850X (ej. WDS100T2X0E, WDS500G4X0E)
 * - WDS*X0J = Black SN850X con disipador
 * - WDBDKC* = Black SN770
 */
function detectWdLineFromMpn(mpn: string): string | null {
	if (!mpn) return null;
	const mpnUpper = mpn.toUpperCase();

	// Patrón base: WDS + capacidad (ej. 500G, 100T, 200T) + versión + sufijo
	// Green - sufijo G0A
	if (mpnUpper.match(/WDS\d+[GT]\d*G0A/)) return "Green";

	// Blue SATA - sufijo B0A
	if (mpnUpper.match(/WDS\d+[GT]\d*B0A/)) return "Blue";

	// Blue SN570 - sufijo B0B
	if (mpnUpper.match(/WDS\d+[GT]\d*B0B/)) return "Blue SN570";

	// Blue SN580 - sufijo B0E o prefijo WDBAUY
	if (mpnUpper.match(/WDS\d+[GT]\d*B0E/) || mpnUpper.startsWith("WDBAUY"))
		return "Blue SN580";

	// Black SN850X - sufijo X0E (ej. WDS500G4X0E, WDS100T2X0E)
	if (mpnUpper.match(/WDS\d+[GT]\d*X0E/)) return "Black SN850X";

	// Black SN850X con disipador - sufijo X0J
	if (mpnUpper.match(/WDS\d+[GT]\d*X0J/)) return "Black SN850X";

	// Black SN770 - prefijo WDBDKC
	if (mpnUpper.startsWith("WDBDKC")) return "Black SN770";

	// Black SN850 - sufijo X0C
	if (mpnUpper.match(/WDS\d+[GT]\d*X0C/)) return "Black SN850";

	return null;
}

/**
 * Extrae y normaliza marca/modelo de SSD
 * @param title - Título del producto
 * @param mpn - MPN del producto (opcional)
 * @param manufacturer - Fabricante desde especificaciones/meta tags (opcional, usado como fallback)
 */
function extractSsdBrandModel(
	title: string,
	mpn?: string,
	manufacturer?: string,
): BrandModel | null {
	const titleUpper = title.toUpperCase();
	const mfrUpper = manufacturer?.toUpperCase() || "";

	// Samsung
	if (titleUpper.includes("SAMSUNG") || mfrUpper.includes("SAMSUNG")) {
		if (titleUpper.includes("990 PRO"))
			return { brand: "Samsung", model: "990 Pro" };
		if (titleUpper.includes("990 EVO"))
			return { brand: "Samsung", model: "990 Evo" };
		if (titleUpper.includes("980 PRO"))
			return { brand: "Samsung", model: "980 Pro" };
		if (titleUpper.includes("980")) return { brand: "Samsung", model: "980" };
		if (titleUpper.includes("970 EVO PLUS"))
			return { brand: "Samsung", model: "970 Evo Plus" };
		if (titleUpper.includes("970 EVO"))
			return { brand: "Samsung", model: "970 Evo" };
		if (titleUpper.includes("870 EVO"))
			return { brand: "Samsung", model: "870 Evo" };
		if (titleUpper.includes("870 QVO"))
			return { brand: "Samsung", model: "870 QVO" };
		if (titleUpper.includes("860 EVO"))
			return { brand: "Samsung", model: "860 Evo" };
		return { brand: "Samsung", model: "" };
	}

	// Kingston
	if (titleUpper.includes("KINGSTON") || mfrUpper.includes("KINGSTON")) {
		const mpnUpper = mpn?.toUpperCase() || "";
		if (titleUpper.includes("KC3000") || mpnUpper.startsWith("SKC3000"))
			return { brand: "Kingston", model: "KC3000" };
		if (titleUpper.includes("NV3") || mpnUpper.startsWith("SNV3"))
			return { brand: "Kingston", model: "NV3" };
		if (titleUpper.includes("NV2") || mpnUpper.startsWith("SNV2"))
			return { brand: "Kingston", model: "NV2" };
		if (titleUpper.includes("NV1") || mpnUpper.startsWith("SNVS"))
			return { brand: "Kingston", model: "NV1" };
		if (titleUpper.includes("A400") || mpnUpper.startsWith("SA400"))
			return { brand: "Kingston", model: "A400" };
		if (titleUpper.includes("A2000") || mpnUpper.startsWith("SA2000"))
			return { brand: "Kingston", model: "A2000" };
		if (titleUpper.includes("FURY RENEGADE") || mpnUpper.startsWith("SFYRS"))
			return { brand: "Kingston", model: "Fury Renegade" };
		if (titleUpper.includes("DC3000") || mpnUpper.startsWith("SEDC3000"))
			return { brand: "Kingston", model: "DC3000" };
		return { brand: "Kingston", model: "" };
	}

	// Western Digital
	if (titleUpper.includes("WD") || titleUpper.includes("WESTERN DIGITAL")) {
		// Primero intentar detectar por título
		if (titleUpper.includes("SN850X"))
			return { brand: "Western Digital", model: "Black SN850X" };
		if (titleUpper.includes("SN850"))
			return { brand: "Western Digital", model: "Black SN850" };
		if (titleUpper.includes("SN770"))
			return { brand: "Western Digital", model: "Black SN770" };
		if (titleUpper.includes("SN580"))
			return { brand: "Western Digital", model: "Blue SN580" };
		if (titleUpper.includes("SN570"))
			return { brand: "Western Digital", model: "Blue SN570" };
		if (titleUpper.includes("WD BLACK"))
			return { brand: "Western Digital", model: "Black" };
		if (titleUpper.includes("WD BLUE"))
			return { brand: "Western Digital", model: "Blue" };
		if (titleUpper.includes("WD GREEN"))
			return { brand: "Western Digital", model: "Green" };

		// Si no se detecta por título, intentar por MPN
		const mpnLine = mpn ? detectWdLineFromMpn(mpn) : null;
		if (mpnLine) {
			return { brand: "Western Digital", model: mpnLine };
		}

		return { brand: "Western Digital", model: "" };
	}

	// Crucial
	if (titleUpper.includes("CRUCIAL")) {
		if (titleUpper.includes("T700")) return { brand: "Crucial", model: "T700" };
		if (titleUpper.includes("T500")) return { brand: "Crucial", model: "T500" };
		if (titleUpper.includes("P5 PLUS"))
			return { brand: "Crucial", model: "P5 Plus" };
		if (titleUpper.includes("P3 PLUS"))
			return { brand: "Crucial", model: "P3 Plus" };
		if (titleUpper.includes("P3")) return { brand: "Crucial", model: "P3" };
		if (titleUpper.includes("MX500"))
			return { brand: "Crucial", model: "MX500" };
		if (titleUpper.includes("BX500"))
			return { brand: "Crucial", model: "BX500" };
		return { brand: "Crucial", model: "" };
	}

	// Seagate
	if (titleUpper.includes("SEAGATE")) {
		if (titleUpper.includes("FIRECUDA 530"))
			return { brand: "Seagate", model: "FireCuda 530" };
		if (titleUpper.includes("FIRECUDA 520"))
			return { brand: "Seagate", model: "FireCuda 520" };
		if (titleUpper.includes("BARRACUDA"))
			return { brand: "Seagate", model: "BarraCuda" };
		return { brand: "Seagate", model: "" };
	}

	// ADATA / XPG
	if (titleUpper.includes("ADATA") || titleUpper.includes("XPG")) {
		if (titleUpper.includes("GAMMIX S70"))
			return { brand: "XPG", model: "Gammix S70" };
		if (titleUpper.includes("GAMMIX S50"))
			return { brand: "XPG", model: "Gammix S50" };
		if (titleUpper.includes("SX8200"))
			return { brand: "ADATA", model: "SX8200" };
		if (titleUpper.includes("LEGEND 960"))
			return { brand: "ADATA", model: "Legend 960" };
		if (titleUpper.includes("LEGEND 850"))
			return { brand: "ADATA", model: "Legend 850" };
		if (titleUpper.includes("LEGEND 800"))
			return { brand: "ADATA", model: "Legend 800" };
		return { brand: "ADATA", model: "" };
	}

	// Corsair
	if (titleUpper.includes("CORSAIR")) {
		if (titleUpper.includes("MP700"))
			return { brand: "Corsair", model: "MP700" };
		if (titleUpper.includes("MP600"))
			return { brand: "Corsair", model: "MP600" };
		if (titleUpper.includes("MP510"))
			return { brand: "Corsair", model: "MP510" };
		return { brand: "Corsair", model: "" };
	}

	// Lexar
	if (titleUpper.includes("LEXAR")) {
		if (titleUpper.includes("NM790")) return { brand: "Lexar", model: "NM790" };
		if (titleUpper.includes("NM710")) return { brand: "Lexar", model: "NM710" };
		if (titleUpper.includes("NM620")) return { brand: "Lexar", model: "NM620" };
		return { brand: "Lexar", model: "" };
	}

	// SK Hynix
	if (titleUpper.includes("SK HYNIX") || titleUpper.includes("HYNIX")) {
		if (titleUpper.includes("P41")) return { brand: "SK Hynix", model: "P41" };
		if (titleUpper.includes("P31")) return { brand: "SK Hynix", model: "P31" };
		return { brand: "SK Hynix", model: "" };
	}

	// Teamgroup
	if (
		titleUpper.includes("TEAMGROUP") ||
		titleUpper.includes("TEAM GROUP") ||
		titleUpper.includes("T-FORCE") ||
		mfrUpper.includes("TEAMGROUP")
	) {
		if (titleUpper.includes("CARDEA"))
			return { brand: "TeamGroup", model: "Cardea" };
		if (titleUpper.includes("MP44"))
			return { brand: "TeamGroup", model: "MP44" };
		if (titleUpper.includes("MP34"))
			return { brand: "TeamGroup", model: "MP34" };
		return { brand: "TeamGroup", model: "" };
	}

	// Hiksemi - Detect line from MPN
	if (titleUpper.includes("HIKSEMI") || mfrUpper.includes("HIKSEMI")) {
		const mpnUpper = mpn?.toUpperCase() || "";
		if (mpnUpper.includes("FUTURE CORE") || mpnUpper.includes("FUTURECORE"))
			return { brand: "Hiksemi", model: "Future Core" };
		if (mpnUpper.includes("FUTURES") || mpnUpper.includes("FUTURE"))
			return { brand: "Hiksemi", model: "Future" };
		if (mpnUpper.includes("WAVE(S)") || mpnUpper.includes("WAVES"))
			return { brand: "Hiksemi", model: "Wave S" };
		if (
			mpnUpper.includes("WAVEP") ||
			mpnUpper.includes("WAVE (P)") ||
			mpnUpper.includes("WAVE-P")
		)
			return { brand: "Hiksemi", model: "Wave P" };
		if (mpnUpper.includes("WAVE")) return { brand: "Hiksemi", model: "Wave" };
		return { brand: "Hiksemi", model: "" };
	}

	// SanDisk - Detect line from MPN
	if (titleUpper.includes("SANDISK") || mfrUpper.includes("SANDISK")) {
		const mpnUpper = mpn?.toUpperCase() || "";
		if (mpnUpper.startsWith("SDSSDA"))
			return { brand: "SanDisk", model: "SSD Plus" };
		if (mpnUpper.startsWith("SDSSDH3"))
			return { brand: "SanDisk", model: "Ultra 3D" };
		if (mpnUpper.startsWith("SDSSDX"))
			return { brand: "SanDisk", model: "Extreme" };
		if (mpnUpper.startsWith("SDSSDXPM"))
			return { brand: "SanDisk", model: "Extreme Pro" };
		return { brand: "SanDisk", model: "" };
	}

	// Micron - Detect line from MPN
	if (titleUpper.includes("MICRON") || mfrUpper.includes("MICRON")) {
		const mpnUpper = mpn?.toUpperCase() || "";
		if (mpnUpper.includes("TGA")) return { brand: "Micron", model: "5400 Pro" };
		if (mpnUpper.includes("TGB")) return { brand: "Micron", model: "5400 Max" };
		if (mpnUpper.startsWith("MTFDKBA"))
			return { brand: "Micron", model: "7450" };
		return { brand: "Micron", model: "" };
	}

	// MSI
	if (titleUpper.includes("MSI") || mfrUpper === "MSI") {
		if (titleUpper.includes("SPATIUM M480"))
			return { brand: "MSI", model: "Spatium M480" };
		if (titleUpper.includes("SPATIUM M470"))
			return { brand: "MSI", model: "Spatium M470" };
		if (titleUpper.includes("SPATIUM M450"))
			return { brand: "MSI", model: "Spatium M450" };
		if (titleUpper.includes("SPATIUM M390"))
			return { brand: "MSI", model: "Spatium M390" };
		if (titleUpper.includes("SPATIUM M371"))
			return { brand: "MSI", model: "Spatium M371" };
		if (titleUpper.includes("SPATIUM S270"))
			return { brand: "MSI", model: "Spatium S270" };
		return { brand: "MSI", model: "" };
	}

	// KingSpec - Detect line from MPN
	if (titleUpper.includes("KINGSPEC") || mfrUpper.includes("KINGSPEC")) {
		const mpnUpper = mpn?.toUpperCase() || "";
		if (mpnUpper.startsWith("P3-") || mpnUpper === "P3")
			return { brand: "KingSpec", model: "P3" };
		if (mpnUpper.startsWith("P4-") || mpnUpper === "P4")
			return { brand: "KingSpec", model: "P4" };
		if (mpnUpper.startsWith("NE-") || mpnUpper.startsWith("NE"))
			return { brand: "KingSpec", model: "NE" };
		if (mpnUpper.startsWith("NT-") || mpnUpper.startsWith("NT"))
			return { brand: "KingSpec", model: "NT" };
		if (mpnUpper.startsWith("NA900S"))
			return { brand: "KingSpec", model: "NA900S" };
		if (mpnUpper.startsWith("XF-")) return { brand: "KingSpec", model: "XF" };
		if (mpnUpper.includes("XG7000") || mpnUpper.startsWith("M.2XG7000"))
			return { brand: "KingSpec", model: "XG7000" };
		return { brand: "KingSpec", model: "" };
	}

	// Verbatim
	if (titleUpper.includes("VERBATIM") || mfrUpper.includes("VERBATIM")) {
		const mpnUpper = mpn?.toUpperCase() || "";
		if (titleUpper.includes("VI550") || mpnUpper.includes("VI550"))
			return { brand: "Verbatim", model: "Vi550" };
		if (titleUpper.includes("VI560") || mpnUpper.includes("VI560"))
			return { brand: "Verbatim", model: "Vi560" };
		if (titleUpper.includes("VI3000") || mpnUpper.includes("VI3000"))
			return { brand: "Verbatim", model: "Vi3000" };
		return { brand: "Verbatim", model: "" };
	}

	return null;
}

/**
 * Extrae el formato del SSD
 */
function extractSsdFormat(title: string): string | null {
	const titleUpper = title.toUpperCase();

	if (titleUpper.includes("M.2 2280") || titleUpper.includes("M2 2280"))
		return "M.2 2280";
	if (titleUpper.includes("M.2 2230") || titleUpper.includes("M2 2230"))
		return "M.2 2230";
	if (titleUpper.includes("M.2") || titleUpper.includes("M2")) return "M.2";
	if (
		titleUpper.includes('2.5"') ||
		titleUpper.includes("2.5''") ||
		titleUpper.includes("2,5")
	)
		return '2.5"';

	return null;
}

/**
 * Extrae el tipo de bus/interfaz del SSD
 */
function extractSsdBus(title: string): string | null {
	const titleUpper = title.toUpperCase();

	if (
		titleUpper.includes("PCIE 5") ||
		titleUpper.includes("GEN5") ||
		titleUpper.includes("GEN 5")
	)
		return "PCIe 5.0";
	if (
		titleUpper.includes("PCIE 4") ||
		titleUpper.includes("GEN4") ||
		titleUpper.includes("GEN 4")
	)
		return "PCIe 4.0";
	if (
		titleUpper.includes("PCIE 3") ||
		titleUpper.includes("GEN3") ||
		titleUpper.includes("GEN 3")
	)
		return "PCIe 3.0";
	if (titleUpper.includes("NVME")) return "NVMe";
	if (titleUpper.includes("SATA")) return "SATA";

	return null;
}

/**
 * Normaliza el título del SSD
 * Formato objetivo: "Marca Modelo Capacidad Formato [Bus]"
 * Ejemplo: "Samsung 990 Pro 2TB M.2 PCIe 4.0"
 */
export function normalizeSsdTitle(
	title: string,
	mpn?: string,
	manufacturer?: string,
): string {
	const cleaned = cleanHtmlEntities(title);

	const brandModel = extractSsdBrandModel(cleaned, mpn, manufacturer);
	const capacity = extractCapacity(cleaned);
	const format = extractSsdFormat(cleaned);
	const bus = extractSsdBus(cleaned);

	if (!brandModel && !capacity) {
		return cleaned;
	}

	const parts: string[] = [];

	if (brandModel) {
		if (brandModel.model) {
			parts.push(`${brandModel.brand} ${brandModel.model}`);
		} else {
			parts.push(brandModel.brand);
		}
	}

	if (capacity) {
		parts.push(capacity);
	}

	if (format) {
		parts.push(format);
	}

	if (bus && !format?.includes("M.2")) {
		// Solo agregar bus si no es obvio desde el formato
		parts.push(bus);
	} else if (bus && format?.includes("M.2") && bus !== "NVMe") {
		// Para M.2, agregar generación PCIe si está disponible
		parts.push(bus);
	}

	return parts.join(" ") || cleaned;
}
