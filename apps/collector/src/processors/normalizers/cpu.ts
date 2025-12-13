/**
 * Normalizador de Títulos de CPU
 * Normaliza los títulos de procesadores a un formato consistente
 * Formato: "Marca Familia Modelo [Núcleos/Hilos]"
 * Ejemplo: "AMD Ryzen 7 7800X3D 8C/16T"
 */

import { cleanHtmlEntities } from "./utils";

/**
 * Normalizador de Títulos de CPUs (Procesadores)
 *
 * Normaliza los títulos de procesadores a un formato consistente.
 * Maneja Intel, AMD y sus diferentes líneas de productos.
 *
 * ADVERTENCIA: Este código es horrible y necesita refactorización urgente.
 * TODO: Mejorar esta atrocidad de normalización cuando tengamos tiempo (nunca).
 */

/** Especificaciones extraídas del CPU */
export interface CpuSpec {
	cores: number;
	threads: number;
}

export const CPU_SPECS: Record<string, CpuSpec> = {
	// Serie AMD Ryzen 9000
	"RYZEN 9 9950X": { cores: 16, threads: 32 },
	"RYZEN 9 9950X3D": { cores: 16, threads: 32 },
	"RYZEN 9 9900X": { cores: 12, threads: 24 },
	"RYZEN 7 9800X3D": { cores: 8, threads: 16 },
	"RYZEN 7 9700X": { cores: 8, threads: 16 },
	"RYZEN 5 9600X": { cores: 6, threads: 12 },
	"RYZEN 5 9600": { cores: 6, threads: 12 },

	// Serie AMD Ryzen 8000
	"RYZEN 7 8700G": { cores: 8, threads: 16 },
	"RYZEN 7 8700F": { cores: 8, threads: 16 },
	"RYZEN 5 8600G": { cores: 6, threads: 12 },
	"RYZEN 5 8500G": { cores: 6, threads: 12 },
	"RYZEN 5 8400F": { cores: 6, threads: 12 },

	// Serie AMD Ryzen 7000
	"RYZEN 9 7950X3D": { cores: 16, threads: 32 },
	"RYZEN 9 7950X": { cores: 16, threads: 32 },
	"RYZEN 9 7900X3D": { cores: 12, threads: 24 },
	"RYZEN 9 7900X": { cores: 12, threads: 24 },
	"RYZEN 9 7900": { cores: 12, threads: 24 },
	"RYZEN 7 7800X3D": { cores: 8, threads: 16 },
	"RYZEN 7 7700X": { cores: 8, threads: 16 },
	"RYZEN 7 7700": { cores: 8, threads: 16 },
	"RYZEN 5 7600X": { cores: 6, threads: 12 },
	"RYZEN 5 7600": { cores: 6, threads: 12 },

	// Serie AMD Ryzen 5000
	"RYZEN 9 5950X": { cores: 16, threads: 32 },
	"RYZEN 9 5900X": { cores: 12, threads: 24 },
	"RYZEN 7 5800X3D": { cores: 8, threads: 16 },
	"RYZEN 7 5800X": { cores: 8, threads: 16 },
	"RYZEN 7 5700X3D": { cores: 8, threads: 16 },
	"RYZEN 7 5700X": { cores: 8, threads: 16 },
	"RYZEN 7 5700G": { cores: 8, threads: 16 },
	"RYZEN 7 5700": { cores: 8, threads: 16 },
	"RYZEN 5 5600X3D": { cores: 6, threads: 12 },
	"RYZEN 5 5600X": { cores: 6, threads: 12 },
	"RYZEN 5 5600G": { cores: 6, threads: 12 },
	"RYZEN 5 5600GT": { cores: 6, threads: 12 },
	"RYZEN 5 5600T": { cores: 6, threads: 12 },
	"RYZEN 5 5600": { cores: 6, threads: 12 },
	"RYZEN 5 5500X3D": { cores: 6, threads: 12 },
	"RYZEN 5 5500GT": { cores: 6, threads: 12 },
	"RYZEN 5 5500": { cores: 6, threads: 12 },
	"RYZEN 3 5300G": { cores: 4, threads: 8 },
	"RYZEN 3 4100": { cores: 4, threads: 8 },

	// Serie AMD Ryzen 3000/4000
	"RYZEN 5 4600G": { cores: 6, threads: 12 },
	"RYZEN 5 4500": { cores: 6, threads: 12 },
	"RYZEN 3 3200G": { cores: 4, threads: 4 },
	"RYZEN 5 3600": { cores: 6, threads: 12 },
	"RYZEN 5 3400G": { cores: 4, threads: 8 },

	// AMD Legacy
	"A6-7400K": { cores: 2, threads: 2 },
	"ATHLON 3000G": { cores: 2, threads: 4 },

	// Intel Core Ultra (Serie 2)
	"CORE ULTRA 9 285K": { cores: 24, threads: 32 },
	"CORE ULTRA 9 285": { cores: 24, threads: 32 },
	"CORE ULTRA 7 265K": { cores: 20, threads: 28 },
	"CORE ULTRA 7 265KF": { cores: 20, threads: 28 },
	"CORE ULTRA 7 265F": { cores: 20, threads: 28 },
	"CORE ULTRA 7 265": { cores: 20, threads: 28 },
	"CORE ULTRA 5 245K": { cores: 14, threads: 20 },
	"CORE ULTRA 5 245KF": { cores: 14, threads: 20 },
	"CORE ULTRA 5 225F": { cores: 10, threads: 16 },
	"CORE ULTRA 5 225": { cores: 10, threads: 16 },

	// Intel Core 14ª Gen
	"CORE I9-14900KS": { cores: 24, threads: 32 },
	"CORE I9-14900K": { cores: 24, threads: 32 },
	"CORE I9-14900KF": { cores: 24, threads: 32 },
	"CORE I9-14900F": { cores: 24, threads: 32 },
	"CORE I9-14900": { cores: 24, threads: 32 },
	"CORE I7-14700K": { cores: 20, threads: 28 },
	"CORE I7-14700KF": { cores: 20, threads: 28 },
	"CORE I7-14700F": { cores: 20, threads: 28 },
	"CORE I7-14700": { cores: 20, threads: 28 },
	"CORE I5-14600K": { cores: 14, threads: 20 },
	"CORE I5-14600KF": { cores: 14, threads: 20 },
	"CORE I5-14600": { cores: 14, threads: 20 },
	"CORE I5-14500": { cores: 14, threads: 20 },
	"CORE I5-14400F": { cores: 10, threads: 16 },
	"CORE I5-14400": { cores: 10, threads: 16 },
	"CORE I3-14100F": { cores: 4, threads: 8 },
	"CORE I3-14100": { cores: 4, threads: 8 },

	// Intel Core 13ª Gen
	"CORE I9-13900K": { cores: 24, threads: 32 },
	"CORE I9-13900KF": { cores: 24, threads: 32 },
	"CORE I9-13900F": { cores: 24, threads: 32 },
	"CORE I9-13900": { cores: 24, threads: 32 },
	"CORE I7-13700K": { cores: 16, threads: 24 },
	"CORE I7-13700KF": { cores: 16, threads: 24 },
	"CORE I7-13700F": { cores: 16, threads: 24 },
	"CORE I7-13700": { cores: 16, threads: 24 },
	"CORE I5-13600K": { cores: 14, threads: 20 },
	"CORE I5-13600KF": { cores: 14, threads: 20 },
	"CORE I5-13500": { cores: 14, threads: 20 },
	"CORE I5-13400F": { cores: 10, threads: 16 },
	"CORE I5-13400": { cores: 10, threads: 16 },
	"CORE I3-13100F": { cores: 4, threads: 8 },
	"CORE I3-13100": { cores: 4, threads: 8 },

	// Intel Core 12ª Gen
	"CORE I9-12900KS": { cores: 16, threads: 24 },
	"CORE I9-12900K": { cores: 16, threads: 24 },
	"CORE I9-12900KF": { cores: 16, threads: 24 },
	"CORE I9-12900F": { cores: 16, threads: 24 },
	"CORE I9-12900": { cores: 16, threads: 24 },
	"CORE I7-12700K": { cores: 12, threads: 20 },
	"CORE I7-12700KF": { cores: 12, threads: 20 },
	"CORE I7-12700F": { cores: 12, threads: 20 },
	"CORE I7-12700": { cores: 12, threads: 20 },
	"CORE I5-12600K": { cores: 10, threads: 16 },
	"CORE I5-12600KF": { cores: 10, threads: 16 },
	"CORE I5-12600": { cores: 6, threads: 12 },
	"CORE I5-12500": { cores: 6, threads: 12 },
	"CORE I5-12400F": { cores: 6, threads: 12 },
	"CORE I5-12400": { cores: 6, threads: 12 },
	"CORE I3-12100F": { cores: 4, threads: 8 },
	"CORE I3-12100": { cores: 4, threads: 8 },

	// Intel Core 10ª/11ª Gen
	"CORE I9-11900K": { cores: 8, threads: 16 },
	"CORE I7-11700K": { cores: 8, threads: 16 },
	"CORE I5-11600K": { cores: 6, threads: 12 },
	"CORE I5-11400F": { cores: 6, threads: 12 },
	"CORE I5-11400": { cores: 6, threads: 12 },
	"CORE I9-10900K": { cores: 10, threads: 20 },
	"CORE I7-10700K": { cores: 8, threads: 16 },
	"CORE I7-10700F": { cores: 8, threads: 16 },
	"CORE I7-10700": { cores: 8, threads: 16 },
	"CORE I5-10600K": { cores: 6, threads: 12 },
	"CORE I5-10400F": { cores: 6, threads: 12 },
	"CORE I5-10400": { cores: 6, threads: 12 },
	"CORE I3-10100F": { cores: 4, threads: 8 },
	"CORE I3-10100": { cores: 4, threads: 8 },

	// Intel Pentium/Celeron
	"PENTIUM G7400": { cores: 2, threads: 4 },
	"PENTIUM G6400": { cores: 2, threads: 4 },
	"PENTIUM G3250": { cores: 2, threads: 2 },
	"PENTIUM G3220": { cores: 2, threads: 2 },
	"CELERON G6900": { cores: 2, threads: 2 },
	"CELERON G5905": { cores: 2, threads: 2 },
};

// Mapeo de MPN a modelo para errores comunes
const MPN_TO_MODEL: Record<string, string> = {
	"100-100001504WOF": "RYZEN 5 5500X3D", // No es 5500X
	"100-100001585BOX": "RYZEN 5 5600T", // No es 5600XT
};

export function normalizeCpuTitle(
	title: string,
	mpn?: string,
	manufacturer?: string,
): string {
	// Eliminar prefijo "PROCESADOR" y limpiar
	const cleanTitle = cleanHtmlEntities(title).replace(/^PROCESADOR\s+/i, "");

	// 1. Detectar Marca
	let brand = "";
	if (/\bAMD\b/i.test(cleanTitle) || manufacturer?.toUpperCase() === "AMD") {
		brand = "AMD";
	} else if (
		/\bINTEL\b/i.test(cleanTitle) ||
		manufacturer?.toUpperCase() === "INTEL"
	) {
		brand = "Intel";
	}

	// 2. Detectar Familia y Modelo
	let family = "";
	let model = "";

	// Verificar mapeo de MPN primero para casos problemáticos conocidos
	if (mpn && MPN_TO_MODEL[mpn]) {
		const mappedModel = MPN_TO_MODEL[mpn];
		const parts = mappedModel.split(" ");
		if (parts.length >= 3) {
			family = `${parts[0]} ${parts[1]}`;
			model = parts[2];
		}
	}

	// Si no se encuentra vía MPN, usar patrones regex
	if (!family || !model) {
		const patterns = [
			// Intel Core Ultra (ej. Core Ultra 9 285K)
			{
				regex: /Core\s+Ultra\s+(\d+)\s+(\d{3}[A-Z]*)/i,
				handler: (m: RegExpMatchArray) => {
					family = `Core Ultra ${m[1]}`;
					model = m[2];
				},
			},
			// Intel Core i-Series (ej. Core i9-14900K, Core i5 12400, I5-14600K)
			{
				regex: /(?:Core\s+)?i(\d+)(?:[-\s]+)(\d{4,5}[A-Z]*)/i,
				handler: (m: RegExpMatchArray) => {
					family = `Core i${m[1]}`;
					model = m[2];
				},
			},
			// AMD Ryzen (ej. Ryzen 7 7800X3D)
			{
				regex: /Ryzen\s+(\d+)\s+(\d{4}[A-Z0-9]*)/i,
				handler: (m: RegExpMatchArray) => {
					family = `Ryzen ${m[1]}`;
					model = m[2];
				},
			},
			// AMD Threadripper
			{
				regex: /Ryzen\s+Threadripper\s+(\d+[A-Z]*)/i,
				handler: (m: RegExpMatchArray) => {
					family = "Ryzen Threadripper";
					model = m[1];
				},
			},
			// Intel Pentium (ej. Pentium Gold G7400, Pentium G3220)
			{
				regex: /Pentium\s+(?:Gold\s+|Silver\s+)?([A-Z]?\d{4}[A-Z]*)/i,
				handler: (m: RegExpMatchArray) => {
					family = "Pentium";
					model = m[1];
				},
			},
			// Intel Celeron (ej. Celeron G6900)
			{
				regex: /Celeron\s+(?:G|N|J)?(\d{4}[A-Z]*)/i,
				handler: (m: RegExpMatchArray) => {
					family = "Celeron";
					model = m[1];
				},
			},
			// AMD Athlon (ej. Athlon 3000G)
			{
				regex: /Athlon\s+(\d+[A-Z]*)/i,
				handler: (m: RegExpMatchArray) => {
					family = "Athlon";
					model = m[1];
				},
			},
			// AMD A-Series (ej. A6-7400K, A6 X2 7400K)
			{
				regex: /A(\d+)(?:\s+X\d+)?(?:-|\s+)(\d{4}[A-Z]*)/i,
				handler: (m: RegExpMatchArray) => {
					family = `A${m[1]}`;
					model = m[2];
				},
			},
		];

		let matched = false;
		for (const p of patterns) {
			const match = cleanTitle.match(p.regex);
			if (match) {
				p.handler(match);
				matched = true;
				break;
			}
		}

		// Fallback para Pentium/Celeron/Athlon
		if (!matched) {
			if (/Pentium/i.test(cleanTitle)) {
				family = "Pentium";
				const m = cleanTitle.match(/G\d{4}|J\d{4}|N\d{4}|\d{4}/i);
				if (m) model = m[0];
			} else if (/Celeron/i.test(cleanTitle)) {
				family = "Celeron";
				const m = cleanTitle.match(/G\d{4}|J\d{4}|N\d{4}|\d{4}/i);
				if (m) model = m[0];
			} else if (/Athlon/i.test(cleanTitle)) {
				family = "Athlon";
				const m = cleanTitle.match(/\d{3,4}[A-Z]*/i);
				if (m) model = m[0];
			}
		}
	}

	// 3. Detectar Núcleos e Hilos
	let cores = 0;
	let threads = 0;

	// Intentar encontrar especificaciones en nuestra base de datos primero
	if (family && model) {
		const lookupKey = buildLookupKey(brand, family, model);

		let spec: CpuSpec | undefined = CPU_SPECS[lookupKey];

		// Búsqueda difusa para nombres de modelos similares
		if (!spec) {
			spec = fuzzyLookup(lookupKey);
		}

		if (spec) {
			cores = spec.cores;
			threads = spec.threads;
		}
	}

	// Si no se encuentra en la BD, intentar extraer del título
	if (cores === 0) {
		const coresMatch = cleanTitle.match(
			/(\d+)\s*(?:Cores?|Núcleos?|Nucleos?|-?Core)/i,
		);
		if (coresMatch) {
			cores = parseInt(coresMatch[1], 10);
		}
	}

	if (threads === 0) {
		const threadsMatch = cleanTitle.match(
			/(\d+)\s*(?:Threads?|Hilos?|-?Thread)/i,
		);
		if (threadsMatch) {
			threads = parseInt(threadsMatch[1], 10);
		}
	}

	// Inferir hilos desde núcleos si faltan (heurística común: Ryzen tiene 2x hilos)
	if (cores > 0 && threads === 0) {
		if (brand === "AMD" && family.includes("Ryzen")) {
			// La mayoría de Ryzen tienen 2 hilos por núcleo, excepto algunos modelos antiguos
			if (model.includes("3200G")) {
				threads = cores; // 3200G es 4C/4T
			} else {
				threads = cores * 2;
			}
		} else if (brand === "Intel") {
			// Los P-cores modernos de Intel tienen HT (2T por núcleo), los E-cores no
			// Por simplicidad, asumimos que si tenemos núcleos pero no hilos de la BD, inferimos basado en generación
			const genMatch = model.match(/^(\d{2})\d{3}/);
			if (genMatch) {
				const gen = parseInt(genMatch[1], 10);
				if (gen >= 12) {
					// Arquitectura híbrida - complejo, pero deberíamos tener datos en BD
					// Si no, es más seguro no inferir
				} else {
					// Generaciones anteriores típicamente tienen HT
					threads = cores * 2;
				}
			}
		}
	}

	// Si tenemos marca, familia y modelo, construir el nuevo título
	if (brand && family && model) {
		model = model.toUpperCase();
		model = model.replace(/x3d/i, "X3D");

		let result = "";

		if (brand === "Intel" && family.startsWith("Core i")) {
			result = `${brand} ${family}-${model}`;
		} else if (
			brand === "AMD" &&
			family.startsWith("A") &&
			family.length <= 3
		) {
			result = `${brand} ${family}-${model}`;
		} else {
			result = `${brand} ${family} ${model}`;
		}

		if (cores > 0) {
			result += ` ${cores}C`;
			if (threads > 0) {
				result += `/${threads}T`;
			}
		}

		return result;
	}

	// Fallback
	return cleanTitle;
}

function buildLookupKey(brand: string, family: string, model: string): string {
	if (brand === "AMD") {
		if (family.startsWith("A")) {
			return `${family}-${model}`.toUpperCase();
		} else {
			return `${family} ${model}`.toUpperCase();
		}
	} else if (brand === "Intel") {
		if (family.startsWith("Core")) {
			const familyParts = family.split(" ");
			if (
				familyParts.length === 2 &&
				familyParts[0] === "Core" &&
				familyParts[1].startsWith("i")
			) {
				return `${familyParts[0]} ${familyParts[1]}-${model}`.toUpperCase();
			} else {
				return `${family} ${model}`.toUpperCase();
			}
		} else {
			return `${family} ${model}`.toUpperCase();
		}
	}
	return `${family} ${model}`.toUpperCase();
}

function fuzzyLookup(key: string): CpuSpec | undefined {
	// Solo intentar formatos alternativos exactos, NO coincidencias parciales
	// Esto previene que nuevos modelos sean incorrectamente emparejados con existentes

	// Intentar variaciones de sufijos comunes que son equivalentes
	const variations = [
		key,
		key.replace(/X3D$/, "X3D"), // Asegurar X3D en mayúsculas
		key.replace(/KF$/, "K"), // KF tiene mismos núcleos/hilos que K
		key.replace(/F$/, ""), // Variante F igual que no-F (solo sin iGPU)
	];

	for (const variant of variations) {
		if (CPU_SPECS[variant]) {
			return CPU_SPECS[variant];
		}
	}

	// NO usar startsWith o coincidencia parcial - causa falsos positivos
	// Si un nuevo modelo de CPU no está en nuestra base de datos, deberíamos extraer del título
	// o dejar vacío en lugar de adivinar incorrectamente

	return undefined;
}
