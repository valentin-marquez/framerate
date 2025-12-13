/**
 * Normalizador de Títulos de Ventiladores de Gabinete
 *
 * Normaliza los títulos de ventiladores a un formato consistente.
 * Formato: "Marca Modelo Tamaño [Características] [Color] [Pack]"
 * Ejemplo: "Corsair LL120 RGB 120mm Dual Light Loop White (Pack 3x)"
 *
 * ADVERTENCIA: Este código es horrible y necesita refactorización urgente.
 * TODO: Mejorar esta atrocidad de normalización cuando tengamos tiempo (nunca).
 * talvez con ML/AI o algo similar.
 */

import { cleanHtmlEntities } from "./utils";

/** Marcas de ventiladores reconocidas */

const BRANDS = [
	"Cooler Master",
	"Antec",
	"XPG",
	"Gamemax",
	"Corsair",
	"Lian Li",
	"Noctua",
	"Arctic",
	"Be Quiet!",
	"Thermaltake",
	"NZXT",
	"Deepcool",
	"Cougar",
	"Aerocool",
	"InWin",
	"Phanteks",
	"SilverStone",
	"Zalman",
	"Triquiet",
	"ID-Cooling",
	"Apnx",
	"Morpheus Gaming",
	"Xyz",
];

const JUNK_TERMS = [
	"VENTILADOR PARA GABINETE",
	"VENTILADOR DE GABINETE",
	"VENTILADORES PARA GABINETE",
	"VENTILADOR GABINETE",
	"VENTILADOR",
	"VENTILADORES",
	"PARA GABINETE",
	"PARA GABIENTE", // Typo común en fuente
	"GABINETE",
	"GABIENTE",
	"FAN",
	"COOLER", // Cuidado con Cooler Master
	"DE",
	"EL",
	"LA",
	"LOS",
	"LAS",
	"UNIDADES",
	"UNIDAD",
	"PARA PC",
	"PARA",
	"PC",
	"GAMER",
	"GAMING", // Cuidado con marcas como Morpheus Gaming
	"ES", // Prefijo "Es"
	"P/N",
	"P/n",
	"MPN",
	"PACK",
	"KIT",
];

const TECH_SPECS_TO_REMOVE = [
	"RING BLADE DESIGN",
	"RBD",
	"ACÚSTICA ABSOLUTA",
	"ACUSTICA ABSOLUTA",
	"HIGH-SPEED",
	"HIGH SPEED",
	"REFRIGERACIÓN SUPERIOR",
	"REFRIGERACION SUPERIOR",
	"DISEÑO MODULAR",
	"DISENO MODULAR",
	"ESPEJO INFINITO",
	"IMANTADO MODULAR UNIVERSAL",
	"ANTI VIBRACIÓN",
	"ANTI VIBRACION",
	"REGULAR AIRFLOW",
	"AIRFLOW",
	"SYNC",
	"CONTROL",
	"4 PINES",
	"CONEXIÓN MOLEX",
	"CONEXION MOLEX",
	"CONEXIÓN EN CADENA",
	"CONEXION EN CADENA",
	"HDB",
	"16 LED",
	"CFM",
	"MMH2O",
	"PWM",
];

export function normalizeCaseFanTitle(
	title: string,
	mpn?: string,
	manufacturer?: string,
): string {
	let cleaned = cleanHtmlEntities(title);

	// 1. Detectar y normalizar Marca
	let brand = "";
	const brandMatch = BRANDS.find((b) =>
		cleaned.toLowerCase().includes(b.toLowerCase()),
	);
	if (brandMatch) {
		brand = brandMatch;
	} else if (manufacturer) {
		const mfrMatch = BRANDS.find((b) =>
			manufacturer.toLowerCase().includes(b.toLowerCase()),
		);
		if (mfrMatch) {
			brand = mfrMatch;
		} else {
			brand = manufacturer; // Fallback al fabricante proporcionado
		}
	}

	// 2. Detectar Cantidad (Kit/Pack)
	let quantitySuffix = "";
	const quantityRegex =
		/(?:kit|pack)\s*(?:de)?\s*(\d+)x?|(?:\s|^)x(\d+)(?:\s|$)|(?:\s|^)(\d+)x(?:\s|$)|(?:\s|^)\((\d+)\)(?:\s|$)|(?:\s|^)x(\d+)(?:\s|$)|(?:\s|^)\(kit\s*(\d+)x?\)|(?:\s|^)\(pack\s*(\d+)x?\)/i;
	const quantityMatch = cleaned.match(quantityRegex);

	if (quantityMatch) {
		const qty =
			quantityMatch[1] ||
			quantityMatch[2] ||
			quantityMatch[3] ||
			quantityMatch[4] ||
			quantityMatch[5] ||
			quantityMatch[6] ||
			quantityMatch[7];
		if (qty && parseInt(qty, 10) > 1) {
			const isKit = cleaned.toLowerCase().includes("kit");
			quantitySuffix = isKit ? `(Kit ${qty}x)` : `(Pack ${qty}x)`;
		}
		cleaned = cleaned.replace(quantityMatch[0], " ");
	} else if (cleaned.toLowerCase().includes("triple pack")) {
		quantitySuffix = "(Pack 3x)";
		cleaned = cleaned.replace(/triple pack/gi, " ");
	} else if (cleaned.toLowerCase().includes("dual pack")) {
		quantitySuffix = "(Pack 2x)";
		cleaned = cleaned.replace(/dual pack/gi, " ");
	}

	// 3. Limpiar MPN y P/N
	if (mpn) {
		cleaned = cleaned.replace(new RegExp(escapeRegExp(mpn), "gi"), "");
	}
	// Eliminar P/N seguido de código
	cleaned = cleaned.replace(/P\/N\s*[\w\-.]+/gi, "");
	cleaned = cleaned.replace(/MPN\s*[\w\-.]+/gi, "");
	// Eliminar P/N independiente
	cleaned = cleaned.replace(/\bP\/?N\b/gi, "");

	// Eliminar cadenas alfanuméricas largas aisladas que parecen MPNs (ej. 0-761345-40047-3)
	cleaned = cleaned.replace(/\b\d+-\d+-\d+-\d+\b/g, "");
	cleaned = cleaned.replace(/\b[A-Z0-9]{10,}\b/g, ""); // Códigos muy largos

	// 4. Limpiar palabras basura y especificaciones técnicas
	// Eliminar "Cooler Master" temporalmente para evitar eliminar "Cooler"
	const isCoolerMaster = brand.toLowerCase() === "cooler master";
	const isMorpheusGaming = brand.toLowerCase() === "morpheus gaming";

	if (isCoolerMaster) {
		cleaned = cleaned.replace(/cooler\s*master/gi, "###BRAND_CM###");
	}
	if (isMorpheusGaming) {
		cleaned = cleaned.replace(/morpheus\s*gaming/gi, "###BRAND_MG###");
	}

	// Eliminar RPM
	cleaned = cleaned.replace(/\d+\s*RPM/gi, " ");

	// Eliminar Especificaciones Técnicas
	TECH_SPECS_TO_REMOVE.forEach((spec) => {
		cleaned = cleaned.replace(new RegExp(escapeRegExp(spec), "gi"), " ");
	});

	// Eliminar números de punto flotante (probablemente specs como CFM, mmH2O, presión estática) - Ejecutar DESPUÉS de eliminar specs nombradas
	cleaned = cleaned.replace(/\b\d+\.\d+\b/g, " ");

	// Eliminar Términos Basura
	JUNK_TERMS.forEach((term) => {
		if (term === "COOLER" && isCoolerMaster) return;
		if ((term === "GAMING" || term === "GAMER") && isMorpheusGaming) return;

		// Usar límites de palabra para palabras cortas
		if (term.length <= 4) {
			cleaned = cleaned.replace(new RegExp(`\\b${term}\\b`, "gi"), " ");
		} else {
			cleaned = cleaned.replace(new RegExp(term, "gi"), " ");
		}
	});

	// Eliminar artefactos específicos
	cleaned = cleaned.replace(/\bA-\b/g, " "); // Eliminar "A-"
	cleaned = cleaned.replace(/\bColor\b/gi, " "); // Eliminar "Color"
	cleaned = cleaned.replace(/\b1\b/g, " "); // Eliminar "1" independiente
	cleaned = cleaned.replace(/--+/g, "-"); // Corregir guiones dobles
	cleaned = cleaned.replace(/\(\s*(?:\d+(?:\s*mm)?\s*)?\)/gi, " "); // Eliminar paréntesis vacíos o con solo números ej. (120)
	cleaned = cleaned.replace(/\s+-\s+/g, " "); // Eliminar guiones aislados
	cleaned = cleaned.replace(/X\d+\)/gi, " "); // Eliminar artefactos como X3)

	if (isCoolerMaster) {
		cleaned = cleaned.replace("###BRAND_CM###", "");
	}
	if (isMorpheusGaming) {
		cleaned = cleaned.replace("###BRAND_MG###", "");
	} else if (brand) {
		// Eliminar marca del título si está presente
		cleaned = cleaned.replace(new RegExp(escapeRegExp(brand), "gi"), "");
	}

	// 5. Normalizar Specs y Extraer Características
	const features: string[] = [];
	const colors: string[] = [];

	// Manejar "Incluye Hub"
	if (cleaned.match(/incluye\s+hub/gi)) {
		features.push("Hub");
		cleaned = cleaned.replace(/incluye\s+hub/gi, "");
	}

	// Tamaño - Normalizar "120mm x 120mm x 25mm" a "120mm"
	cleaned = cleaned.replace(
		/(\d+)\s*mm\s*x\s*\d+\s*mm(?:\s*x\s*\d+\s*mm)?/gi,
		"$1mm",
	);
	cleaned = cleaned.replace(
		/(\d+)\s*cm\s*x\s*\d+\s*cm(?:\s*x\s*\d+\s*cm)?/gi,
		(_match, num) => `${parseInt(num, 10) * 10}mm`,
	);

	// Eliminar dimensiones de grosor (ej. "x 25mm") - Usar límite de palabra para evitar comer letras como en "Lx"
	cleaned = cleaned.replace(/\bx\s*\d+\s*mm/gi, "");

	// Estandarizar tamaño simple
	cleaned = cleaned.replace(/(\d+)\s*(?:mm|cm)/gi, (match, num) => {
		if (match.toLowerCase().includes("cm")) {
			return `${parseInt(num, 10) * 10}mm`;
		}
		return `${num}mm`;
	});

	// Extraer Características
	const featureMap: Record<string, string> = {
		ARGB: "ARGB",
		RGB: "RGB",
		CONTROLADORA: "Controller",
		CONTROLLER: "Controller",
		ADAPTER: "Adapter",
		ADAPTADOR: "Adapter",
		REVERSE: "Reverse",
	};

	for (const [key, value] of Object.entries(featureMap)) {
		const regex = new RegExp(`\\b${key}\\b`, "gi");
		if (regex.test(cleaned)) {
			features.push(value);
			cleaned = cleaned.replace(regex, "");
		}
	}

	// Extraer Colores
	const colorMap: Record<string, string> = {
		WHITE: "White",
		BLANCO: "White",
		BLACK: "Black",
		NEGRO: "Black",
		RED: "Red",
		ROJO: "Red",
		BLUE: "Blue",
		AZUL: "Blue",
	};

	for (const [key, value] of Object.entries(colorMap)) {
		const regex = new RegExp(`\\b${key}\\b`, "gi");
		if (regex.test(cleaned)) {
			if (!colors.includes(value)) {
				colors.push(value);
			}
			cleaned = cleaned.replace(regex, "");
		}
	}

	// 6. Limpieza final y Title Case
	// Eliminar comas y espacios extra
	cleaned = cleaned.replace(/,/g, " ").replace(/\s+/g, " ").trim();
	cleaned = toTitleCase(cleaned);

	// Corregir problema "Modelmm" (ej. RS120mm -> RS120 120mm) - Ejecutar inmediatamente después de TitleCase
	// Manejar caso específico Cougar VX: VX120mm -> VX 120mm
	cleaned = cleaned.replace(/\bVx(\d+)mm\b/g, "VX $1mm");
	// Manejar casos donde mm está pegado al número de modelo
	cleaned = cleaned.replace(/\b([A-Za-z]+)(\d+)mm\b/g, "$1$2 $2mm");

	// Corregir "Triquiet ... 3" -> "Triquiet ... 3-Speed"
	if (brand.toLowerCase().includes("triquiet")) {
		cleaned = cleaned.replace(/\b3\b/g, "3-Speed");
	}

	// Corregir modelos Gamemax usando MPN (Después de TitleCase para asegurar capitalización correcta)
	if (brand.toLowerCase() === "gamemax" && mpn) {
		const upperMpn = mpn.toUpperCase();
		if (
			upperMpn.includes("FN12A-S8I-R") &&
			!cleaned.toUpperCase().includes("FN12A")
		) {
			cleaned = cleaned.replace(/120mm/gi, "").trim();
			cleaned += " FN12A-S8I-R";
			if (
				upperMpn.includes("BLACK") &&
				!cleaned.includes("Black") &&
				!colors.includes("Black")
			) {
				cleaned += " Black";
			}
		} else if (
			upperMpn.includes("FN-12RAINBOW-C9") &&
			!cleaned.toUpperCase().includes("RAINBOW-C9")
		) {
			cleaned = cleaned.replace(/120mm/gi, "").trim();
			cleaned += " FN12 Rainbow C9";
		} else if (
			upperMpn.includes("FN-12RAINBOW-Q-INFINITY") &&
			!cleaned.toUpperCase().includes("Q-INFINITY")
		) {
			cleaned = cleaned.replace(/120mm/gi, "").trim();
			cleaned += " FN12 Rainbow Q-Infinity";
		}
	}

	// Corregir capitalizaciones específicas después de Title Case
	cleaned = cleaned
		.replace(/\bRpm\b/g, "RPM")
		.replace(/(\d+)Mm/g, "$1mm")
		.replace(/\bMf(\d+)/g, "MF$1")
		.replace(/\bFp(\d+)/g, "FP$1")
		.replace(/\bWf\b/g, "WF")
		.replace(/\bDf\b/g, "DF")
		.replace(/\bVx(\d+)/g, "VX$1") // Corregir Vx120 -> VX120
		.replace(/\bVx\b/g, "VX") // Corregir Vx independiente -> VX
		.replace(/\bRs(\d+)/g, "RS$1")
		.replace(/\bSc(\d+)/g, "SC$1")
		.replace(/\bHdb\b/g, "HDB")
		.replace(/\bHs\b/g, "HS")
		.replace(/\bLx\b/g, "LX")
		.replace(/\bEdt\b/g, "EDT")
		.replace(/\bF12rgb\b/g, "F12 RGB")
		.replace(/(\d+)p\b/g, "$1P") // Corregir 120p -> 120P
		.replace(/-r\b/g, "-R") // Corregir -r -> -R
		.replace(/-xt\b/g, "-XT") // Corregir -xt -> -XT
		.replace(/-+\s*trio\b/gi, " Trio"); // Corregir -trio -> Trio

	// Corregir "Apolar 120" -> "Apolar 120mm"
	cleaned = cleaned.replace(/\bApolar\s+120\b(?!\s*mm)/gi, "Apolar 120mm");

	// Eliminar caracteres no alfanuméricos iniciales/finales (como + o -)
	cleaned = cleaned.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9)]+$/g, "");

	// Eliminar tamaño redundante si está presente en el modelo (ej. "Apolar 120 120mm" -> "Apolar 120mm")
	// También manejar "120mm 120mm" -> "120mm"
	cleaned = cleaned.replace(/(\d+)\s+\1mm/gi, "$1mm");
	cleaned = cleaned.replace(/(\d+)mm\s+\1mm/gi, "$1mm");

	// Corregir paréntesis vacíos o con solo números ej. (120) o (120 )
	cleaned = cleaned.replace(/\(\s*(?:\d+(?:\s*mm)?\s*)?\)/gi, " ");

	// 7. Construir título final
	let finalTitle = `${brand} ${cleaned}`;

	// Anexar características y colores
	// Eliminar RGB si ARGB está presente
	if (features.includes("ARGB") && features.includes("RGB")) {
		const rgbIndex = features.indexOf("RGB");
		if (rgbIndex > -1) {
			features.splice(rgbIndex, 1);
		}
	}

	if (features.length > 0) {
		finalTitle += ` ${features.join(" ")}`;
	}
	if (colors.length > 0) {
		finalTitle += ` ${colors.join(" ")}`;
	}

	if (quantitySuffix) {
		finalTitle += ` ${quantitySuffix}`;
	}

	return finalTitle.replace(/\s+/g, " ").trim();
}

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTitleCase(str: string): string {
	return str.replace(
		/\w\S*/g,
		(txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
	);
}
