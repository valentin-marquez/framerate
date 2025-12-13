/**
 * Normalizador de Títulos de PSU (Fuentes de Poder)
 *
 * Normaliza títulos de fuentes de poder a un formato consistente.
 * Formato: "Marca Serie/Modelo Wattage Certificación Modular [FactorForma] [Color]"
 * Ejemplo: "Corsair RM750e 750W 80+ Gold Modular"
 *
 * ADVERTENCIA: Este código es horrible y necesita refactorización urgente.
 * TODO: Mejorar esta atrocidad de normalización cuando tengamos tiempo (nunca).
 */

import { cleanHtmlEntities } from "./utils";

/** Marcas de PSU reconocidas */

const PSU_BRANDS: Record<string, string> = {
	ANTEC: "Antec",
	CORSAIR: "Corsair",
	GIGABYTE: "Gigabyte",
	MSI: "MSI",
	ADATA: "ADATA",
	XPG: "XPG",
	GAMEMAX: "Gamemax",
	"COOLER MASTER": "Cooler Master",
	COOLERMASTER: "Cooler Master",
	"BE QUIET!": "Be quiet!",
	"BE QUIET": "Be quiet!",
	COUGAR: "Cougar",
	CLIO: "Clio",
	XTECH: "Xtech",
	EVGA: "EVGA",
	SEASONIC: "Seasonic",
	THERMALTAKE: "Thermaltake",
	DEEPCOOL: "DeepCool",
	ASUS: "ASUS",
	NZXT: "NZXT",
	FSP: "FSP",
	SILVERSTONE: "SilverStone",
	LIANLI: "Lian Li",
	"LIAN LI": "Lian Li",
	XYZ: "XYZ",
};

const CERTIFICATIONS: Record<string, string> = {
	TITANIUM: "80+ Titanium",
	PLATINUM: "80+ Platinum",
	PLATINIUM: "80+ Platinum",
	PLATINO: "80+ Platinum",
	GOLD: "80+ Gold",
	ORO: "80+ Gold",
	SILVER: "80+ Silver",
	PLATA: "80+ Silver",
	BRONZE: "80+ Bronze",
	BRONCE: "80+ Bronze",
	WHITE: "80+ White",
	BLANCO: "80+ White",
	STANDARD: "80+ White",
	ESTANDAR: "80+ White",
};

export function extractWattage(title: string): string | null {
	const match = title.match(/(\d{3,4})\s*[wW]\b/);
	if (match) {
		return `${match[1]}W`;
	}
	return null;
}

export function extractCertification(title: string): string | null {
	const titleUpper = title.toUpperCase();

	// Check for "80 PLUS" or "80+" followed by certification level
	const match = titleUpper.match(
		/80\s*(?:\+|PLUS)\s*(TITANIUM|PLATINUM|PLATINIUM|PLATINO|GOLD|ORO|SILVER|PLATA|BRONZE|BRONCE|WHITE|BLANCO|STANDARD|ESTANDAR)?/i,
	);

	if (match) {
		const level = match[1] || "WHITE"; // Default to White if just "80 Plus" is mentioned
		return CERTIFICATIONS[level] || null;
	}

	// Fallback: Check for standalone certification keywords if "80 PLUS" is missing
	// We must be careful not to match colors like "WHITE" or "SILVER" if they refer to the case color
	// But "BRONZE", "GOLD", "PLATINUM", "TITANIUM" are almost always certifications in PSU context
	const standaloneMatch = titleUpper.match(
		/\b(TITANIUM|PLATINUM|PLATINIUM|PLATINO|GOLD|ORO|BRONZE|BRONCE)\b/i,
	);
	if (standaloneMatch) {
		return CERTIFICATIONS[standaloneMatch[1]] || null;
	}

	return null;
}

export function extractModular(title: string): string | null {
	const titleUpper = title.toUpperCase();

	if (
		titleUpper.includes("FULL MODULAR") ||
		titleUpper.includes("FULLY MODULAR")
	) {
		return "Fully Modular";
	}

	if (
		titleUpper.includes("SEMI MODULAR") ||
		titleUpper.includes("SEMI-MODULAR") ||
		titleUpper.includes("SEMIMODULAR")
	) {
		return "Semi-Modular";
	}

	if (
		titleUpper.includes("MODULAR") &&
		!titleUpper.includes("NON-MODULAR") &&
		!titleUpper.includes("NO MODULAR")
	) {
		return "Modular";
	}

	return null;
}

export function extractFormFactor(title: string): string | null {
	const titleUpper = title.toUpperCase();
	const factors: string[] = [];

	if (titleUpper.match(/ATX\s*3\.?0/)) {
		factors.push("ATX 3.0");
	}

	if (titleUpper.includes("SFX-L")) {
		factors.push("SFX-L");
	} else if (titleUpper.includes("SFX")) {
		factors.push("SFX");
	}

	if (titleUpper.includes("SLIM")) {
		factors.push("Slim");
	}

	if (factors.length > 0) {
		return factors.join(" ");
	}

	// Default ATX if nothing else found? No, better to return null if not explicit.
	// But psu.ts extractFormFactorFromName returns "ATX" if "ATX" is present.
	if (titleUpper.includes("ATX") && !factors.includes("ATX 3.0")) {
		// Check if it's not Micro ATX or something else (though usually PSU form factor is just ATX)
		// But wait, "ATX" is very common in titles.
		return "ATX";
	}

	return null;
}

export function extractColor(title: string): string | null {
	const titleUpper = title.toUpperCase();

	if (titleUpper.includes("WHITE") || titleUpper.includes("BLANCO")) {
		// Verify it's not just part of "80+ White"
		// Remove "80+ White" and see if "White" remains
		const temp = titleUpper
			.replace(/80\s*(?:\+|PLUS)\s*WHITE/g, "")
			.replace(/80\s*(?:\+|PLUS)\s*BLANCO/g, "");

		if (temp.includes("WHITE") || temp.includes("BLANCO")) {
			return "White";
		}
	}

	// RGB is often a feature/series, not just a color.
	// We'll extract it, but we might handle it differently in the main function depending on brand.
	if (titleUpper.includes("RGB")) {
		return "RGB";
	}

	return null;
}

export function extractBrand(
	title: string,
	manufacturer?: string,
): string | null {
	const titleUpper = title.toUpperCase();

	// Priority check for XPG
	if (titleUpper.includes("XPG")) {
		return "XPG";
	}

	// Try to find brand in title
	for (const [key, value] of Object.entries(PSU_BRANDS)) {
		// Check for word boundary to avoid partial matches
		// Escape special characters in key (like "Be quiet!")
		const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regex = new RegExp(`\\b${escapedKey}\\b`, "i");
		if (regex.test(title)) {
			return value;
		}
	}

	// Fallback to manufacturer
	if (manufacturer) {
		const manuUpper = manufacturer.toUpperCase();
		if (PSU_BRANDS[manuUpper]) {
			return PSU_BRANDS[manuUpper];
		}
		// Keep original casing if short (likely acronym), else Title Case
		if (manufacturer.length <= 3) {
			return manufacturer.toUpperCase();
		}
		return (
			manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase()
		);
	}

	return null;
}

function cleanSeriesModel(title: string, brand: string): string {
	let cleaned = title;

	// 1. Pre-cleaning / Protection
	if (brand === "Cooler Master") {
		cleaned = cleaned.replace(/\bMWE GOLD\b/gi, "##MWE_GOLD##");
	}

	// Pre-cleaning specific brand fixes
	if (brand === "Gamemax") {
		// Preserve Gamemax models that are often labeled as P/N
		const match = cleaned.match(/P\/N\s*(GS-\d+|VP-\d+|GP-\d+|GX-\d+)/i);
		if (match) {
			cleaned = cleaned.replace(/P\/N\s*(GS-\d+|VP-\d+|GP-\d+|GX-\d+)/i, "$1");
		}
	}

	// Remove brand (improved boundary check)
	const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const startBoundary = /^\w/.test(brand) ? "\\b" : "";
	const endBoundary = /\w$/.test(brand) ? "\\b" : "";
	const brandRegex = new RegExp(
		`${startBoundary}${escapedBrand}${endBoundary}`,
		"gi",
	);
	cleaned = cleaned.replace(brandRegex, "");

	// Remove common noise
	cleaned = cleaned
		.replace(/\bGeneric\b/gi, "") // Remove Generic
		.replace(/\bGX-\d+\S*[A-Z]\S*\b/gi, "") // Remove Gamemax weird P/N with letters
		.replace(/FUENTE DE PODER/gi, "")
		.replace(/FUENTE/gi, "")
		.replace(/POWER SUPPLY/gi, "")
		.replace(/PSU/gi, "")
		.replace(/\bATX\s*3\.?[01]?\b/gi, "") // Remove ATX 3.0/3.1
		.replace(/\bPCIe\s*5\.?[01]?\b/gi, "") // Remove PCIe 5.0/5.1
		.replace(/\bPCI\s*5\.?[01]?\b/gi, "") // Remove PCI 5.0
		.replace(/(\d+x\s*)?12V-2x6/gi, "") // Remove 12V-2x6 and optional quantifier (2x 12V-2x6)
		.replace(/\b12VHPWR\b/gi, "")
		.replace(/\bATX\s*12V\s*2\.?\d*\b/gi, "")
		.replace(/\b12V\b/gi, "") // Remove standalone 12V
		.replace(/\b230V\b/gi, "")
		.replace(/\b110V\b/gi, "")
		.replace(/\b220V\b/gi, "")
		.replace(/\bActive PFC\b/gi, "")
		.replace(/\bPFC Activo\b/gi, "")
		.replace(/\b120\s*mm\b/gi, "")
		.replace(/\bCable no incluido\b/gi, "")
		.replace(/\bW\/POWER CORD\b/gi, "")
		.replace(/\bCORD\b/gi, "") // Remove CORD
		.replace(/\bCables Planos\b/gi, "")
		.replace(/\(20\+4PIN\)/gi, "")
		.replace(/\b20\+4\b/gi, "") // Remove 20+4
		.replace(/\bW\/2 SATA\b/gi, "")
		.replace(/\b2 SATA\b/gi, "") // Remove 2 SATA
		.replace(/\b2 MOLEX\b/gi, "")
		.replace(/\bCON SWITCH CORTE\b/gi, "")
		.replace(/\bCertificada\b/gi, "")
		.replace(/\bCertificación\b/gi, "")
		.replace(/\bCertificado\b/gi, "")
		.replace(/\bNegro\b/gi, "")
		.replace(/\bBlack\b/gi, "")
		.replace(/\bBLACK\b/gi, "") // Remove BLACK
		.replace(/\bWhite\b/gi, "") // Remove White
		.replace(/\bPIN\b/gi, "") // Remove PIN
		.replace(/\bEC\b/g, "") // Antec suffix
		.replace(/\bBK\b/g, "") // Gamemax suffix
		.replace(/\bMODELO\b/gi, "")
		.replace(/\bSIN CBALE DE PODER\b/gi, "")
		.replace(/\bREALES\b/gi, "")
		.replace(/\bNORMA\b/gi, "")
		.replace(/\bVERSION\b/gi, "")
		.replace(/\bVER\b/gi, "") // Remove VER
		.replace(/\bSEMIMODULAR\b/gi, "")
		.replace(/\bSEMI MODULAR\b/gi, "") // Added space variant
		.replace(/\bFULL MODULAR\b/gi, "")
		.replace(/\bFULLY MODULAR\b/gi, "")
		.replace(/\bMODULAR\b/gi, "")
		.replace(/\b80\s*(?:\+|PLUS)\s*\w+\b/gi, "") // Remove certification
		.replace(/\b80\s*(?:\+|PLUS)(?=\s|$)/gi, "") // Remove standalone 80 PLUS
		.replace(/\b80\b/g, "") // Remove standalone 80
		.replace(/\d{3,4}\s*[wW]\b/gi, "") // Remove wattage
		.replace(/\s+P\/N\s*:?.*$/i, "") // Remove P/N at end
		.replace(/\s+P\/N.*$/i, "")
		.replace(/\s+0-\d{6}-\d{5}-\d/g, "") // Antec P/N format
		.replace(/\s-\s[A-Z0-9]{10,}$/i, "") // Generic P/N at end (dash followed by long alphanumeric)
		.replace(/3,1\/5,1/g, "") // Remove Gamemax 3,1/5,1 artifact
		.replace(/[,]/g, "") // Remove commas
		.replace(/\//g, "") // Remove slashes
		.replace(/\bSFX\b/gi, "") // Remove Form Factor
		.replace(/\bSLIM\b/gi, "") // Remove Form Factor
		.replace(/\bMICROATX\b/gi, "") // Remove Form Factor
		// NEW: Remove specific P/N patterns like MPX-..., MPE-..., CP-..., PK-..., MAG...
		.replace(/\bMP[A-Z]-[A-Z0-9-]+\b/gi, "") // Cooler Master MPX/MPE/MPW relaxed
		.replace(/\bCP-\d{4}.*$/i, "") // Corsair CP
		.replace(/\bPK-\d{3,4}.*$/i, "") // DeepCool PK
		.replace(/\bRSS\d{4}.*$/i, "") // Corsair RSS
		// NEW NOISE REMOVAL
		.replace(/\bFM\b/gi, "") // Remove FM
		.replace(/\b\d+\.\d+\.\d+\b/g, "") // Remove version numbers like 3.15.1
		.replace(/\bSFF\b/gi, "")
		.replace(/\bATX\b/gi, "")
		.replace(/\bColor\b/gi, "")
		.replace(/\b5\.1\b/g, "")
		.replace(/\b3\.1\b/g, "")
		.replace(/\b3\.0\b/g, "") // Remove 3.0
		.replace(/([A-Z0-9]+)-($|\s)/g, "$1$2") // Remove trailing dash
		.replace(/-+/g, "-") // Collapse dashes
		.replace(/-\s/g, " ") // Remove dash followed by space
		.replace(/\s-/g, " ") // Remove space followed by dash
		.replace(/^-+|-+$/g, "") // Remove leading/trailing dashes
		.replace(/\s+/g, " ")
		.trim();

	// Restore protected tokens
	if (brand === "Cooler Master") {
		cleaned = cleaned.replace(/##MWE_GOLD##/g, "MWE Gold");
	}

	// Specific Series/Model corrections
	if (brand === "Antec") {
		// Remove standalone series names FIRST to avoid duplication when we expand codes
		cleaned = cleaned
			.replace(/\bATOM\b/i, "")
			.replace(/\bCUPRUM STRIKE\b/i, "")
			.replace(/\bNEOECO\b/i, "")
			.replace(/\bSEMI\b/i, "") // Remove stray SEMI
			.replace(/\bBRONZE\b/i, "") // Remove stray BRONZE
			.replace(/\bGOLD\b/i, "") // Remove stray GOLD
			.replace(/\bM\b/g, ""); // Remove stray M (often from Modular)

		cleaned = cleaned
			.replace(/\bCSK(\d+)(H?)\b/i, "Cuprum Strike CSK$1$2")
			.replace(/\bNE(\d+)([GM]?)\b/i, "NeoEco NE$1$2") // Updated regex for NE550M
			.replace(/\bB(\d+)\b/i, "Atom B$1"); // B650 -> Atom B650

		// Re-add series name if we just have the model number now (and regex didn't catch it)
		if (cleaned.match(/^B\d+$/)) cleaned = `Atom ${cleaned}`;
		if (cleaned.match(/^CSK\d+H?$/)) cleaned = `Cuprum Strike ${cleaned}`;
		if (cleaned.match(/^NE\d+[GM]?$/)) cleaned = `NeoEco ${cleaned}`;
	}

	if (brand === "XPG") {
		// Ensure proper casing for XPG series
		cleaned = cleaned
			.replace(/\bADATA\b/gi, "") // Remove ADATA if brand is XPG
			.replace(/\bKYBER\b/i, "Kyber")
			.replace(/\bPROBE\b/i, "Probe")
			.replace(/\bPYLON\b/i, "Pylon")
			.replace(/\bCORE REACTOR\b/i, "Core Reactor")
			.replace(/\bCYBERCORE\b/i, "Cybercore")
			.replace(/\bGOLD\b/i, "") // Remove stray GOLD
			.replace(/\bBRONZE\b/i, ""); // Remove stray BRONZE
	}
	if (brand === "ADATA") {
		cleaned = cleaned
			.replace(/\bXPG\b/i, "") // Remove XPG if brand is ADATA (we want XPG as brand usually, but if ADATA is detected first)
			.replace(/\bKYBER\b/i, "Kyber")
			.replace(/\bPROBE\b/i, "Probe")
			.replace(/\bPYLON\b/i, "Pylon")
			.replace(/\bGOLD\b/i, "");
	}

	if (brand === "Gamemax") {
		cleaned = cleaned
			.replace(/\bVP-SERIE\b/i, "")
			.replace(/\bVP-(\d+)\b/i, "VP-$1")
			.replace(/\bGP-(\d+)\b/i, "GP-$1")
			.replace(/\bGX-(\d+)\b/i, "GX-$1")
			.replace(/\bGS-(\d+)\b/i, "GS-$1")
			.replace(/\b31\/51\b/g, "") // Remove 3,1/5,1 artifacts
			.replace(/\bRGB\b/i, "") // Remove RGB from model name (added back later)
			.replace(/\bBRONZE\b/i, ""); // Remove stray BRONZE
	}

	if (brand === "Cooler Master") {
		cleaned = cleaned
			.replace(/\bELITE NEX\b/i, "Elite NEX")
			.replace(/\bELITE GOLD\b/i, "Elite Gold")
			// MWE Gold is protected, so we don't need to restore it here, it's already restored.
			.replace(/\bMPE\b/i, "MPE")
			.replace(/\bV\s*(\d+)\s*SFX\b/i, "V$1 SFX"); // Handle V SFX series
		// REMOVED GOLD/BRONZE removal here
	}

	if (brand === "Be quiet!") {
		cleaned = cleaned
			.replace(/\bSYSTEM POWER\b/i, "System Power")
			.replace(/\bPURE POWER\b/i, "Pure Power")
			.replace(/\bSTRAIGHT POWER\b/i, "Straight Power")
			.replace(/\bDARK POWER\b/i, "Dark Power")
			.replace(/\bBN\d{3}\b/i, ""); // Remove BN codes
	}

	if (brand === "Gigabyte") {
		cleaned = cleaned.replace(/\bBRONZE\b/i, "");
	}

	if (brand === "Corsair") {
		cleaned = cleaned.replace(/\bBRONZE\b/i, "");
	}

	// Clean up any double spaces or leading/trailing punctuation
	cleaned = cleaned
		.replace(/\s+/g, " ")
		.replace(/^[-,.]\s*/, "")
		.replace(/\s*[-,.]$/, "")
		.trim();

	// Title Case lowercase words > 2 chars
	cleaned = cleaned.replace(/\b([a-z]{3,})\b/g, (match) => {
		return match.charAt(0).toUpperCase() + match.slice(1);
	});

	// Title Case the remaining model string if it looks like a generic word (not a code)
	// This helps with "VOLT" -> "Volt"
	if (
		cleaned === cleaned.toUpperCase() &&
		cleaned.length > 3 &&
		!/\d/.test(cleaned)
	) {
		cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
	}

	// Title Case after hyphen (Fix for Pro-M)
	cleaned = cleaned.replace(/-([a-z])/g, (_match, p1) => {
		return `-${p1.toUpperCase()}`;
	});

	return cleaned;
}

export function normalizePsuTitle(
	title: string,
	_mpn?: string,
	manufacturer?: string,
): string {
	// 1. Clean HTML entities
	const cleanTitle = cleanHtmlEntities(title);

	// 2. Extract Components
	const brand = extractBrand(cleanTitle, manufacturer) || "Generic";
	let wattage = extractWattage(cleanTitle);
	let certification = extractCertification(cleanTitle);
	const modular = extractModular(cleanTitle);
	const formFactor = extractFormFactor(cleanTitle);
	const color = extractColor(cleanTitle);

	// 3. Extract and Clean Series/Model
	let model = cleanSeriesModel(cleanTitle, brand);

	// Special handling for Gamemax RGB
	// If brand is Gamemax and color is RGB, we might want to put RGB in the model name
	if (brand === "Gamemax" && color === "RGB") {
		// If model doesn't already have RGB (it shouldn't, we removed it), add it
		// But wait, the test expects "Gamemax RGB 1300W..."
		// So "RGB" is the model.
		if (model === "") {
			model = "RGB";
		} else {
			model = `RGB ${model}`; // Prepend RGB? Or Append? Test: "Gamemax RGB 1300W" -> Model is "RGB"
		}
	}

	// 4. Inference from Model (if missing)
	if (!wattage && model) {
		// Try to find a number that looks like wattage (e.g. 500, 650, 750, 850, 1000, 1200, 1300, 1600)
		// Usually at the end of the model or part of it (B750, A750, VP-700, etc.)
		const wattageMatch = model.match(/(?:^|[-A-Z])(\d{3,4})(?:$|[A-Z])/i);
		if (wattageMatch) {
			const val = parseInt(wattageMatch[1], 10);
			// Sanity check for common PSU wattages
			if (val >= 300 && val <= 2000 && val % 50 === 0) {
				wattage = `${val}W`;
			}
		}
	}

	if (!certification && model) {
		// Inference based on model prefixes/suffixes
		// Antec Atom Bxxx -> Bronze
		if (brand === "Antec" && model.startsWith("Atom B")) {
			certification = "80+ Bronze";
		}
		// Corsair RMxxx -> Gold
		if (brand === "Corsair" && /^RM\d+e?$/.test(model)) {
			certification = "80+ Gold";
		}
	}

	// 5. Certification Override / Inference from Title Keywords
	// If certification is weak (White/Standard) or missing, but title contains strong keywords like "Bronze", "Gold", etc.
	// This handles cases where "80+ White" is detected but "Bronze" is also present (e.g. "Corsair CX750 Bronze ... 80+ White")
	// We trust the explicit metal name in the title if it contradicts "80+ White".
	if (!certification || certification === "80+ White") {
		if (/\bBronze\b/i.test(cleanTitle)) {
			certification = "80+ Bronze";
		} else if (/\bGold\b/i.test(cleanTitle)) {
			certification = "80+ Gold";
		} else if (/\bPlatinum\b/i.test(cleanTitle)) {
			certification = "80+ Platinum";
		}
	}

	// 6. Build Normalized Title
	const parts: string[] = [];

	// [Brand]
	parts.push(brand);

	// [Series/Model]
	if (model) {
		parts.push(model);
	}

	// [Wattage]
	if (wattage) {
		parts.push(wattage);
	}

	// [Certification]
	if (certification) {
		parts.push(certification);
	}

	// [Modular]
	if (modular) {
		parts.push(modular);
	}

	// [Form Factor]
	if (formFactor) {
		parts.push(formFactor);
	}

	// [Color]
	if (color) {
		// Don't add RGB again if we added it to model for Gamemax
		if (brand === "Gamemax" && color === "RGB") {
			// Already handled
		}
		// Don't add White if certification is already 80+ White
		else if (color === "White" && certification === "80+ White") {
			// Skip
		} else {
			parts.push(color);
		}
	}

	// 7. Final Cleanup
	// Remove duplicates (case insensitive)
	const uniqueParts = parts.filter((item, index) => {
		const lowerItem = item.toLowerCase();
		return parts.findIndex((p) => p.toLowerCase() === lowerItem) === index;
	});

	return uniqueParts.join(" ");
}
