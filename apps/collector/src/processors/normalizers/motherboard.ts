/**
 * Normalizador de Títulos de Placas Madre/Motherboards
 *
 * Normaliza los títulos de placas madre a un formato consistente.
 * Formato: "Marca Modelo Chipset [WiFi]"
 * Ejemplo: "ASUS ROG Strix B650-A Gaming WiFi"
 *
 * ADVERTENCIA: Este código es horrible y necesita refactorización urgente.
 * TODO: Mejorar esta atrocidad de normalización cuando tengamos tiempo (nunca).
 */

import { cleanHtmlEntities } from "./utils";

export function normalizeMotherboardTitle(
	title: string,
	_mpn?: string,
	manufacturer?: string,
): string {
	let normalized = cleanHtmlEntities(title);

	// 1. Eliminar prefijos comunes e información redundante
	normalized = normalized
		.replace(
			/^(COMBO\s+)?(PLACA MADRE|Motherboard|Placa Base|Mainboard)\s+/i,
			"",
		)
		.replace(/\s+P\/N\s*:?.*$/i, "") // Eliminar P/N al final
		.replace(/\s+P\/N.*$/i, "") // Eliminar P/N en cualquier lugar si es la última parte
		.replace(/\s+P\/N\s+[A-Z0-9-]+/i, "") // Eliminar P/N en el medio
		.replace(/\s+INTEL\s+FCBGA\d+/i, "")
		.replace(/\s+\d+\/\d+\/\d+/g, "") // Eliminar 10/100/1000
		.replace(/\s+-\s*ATX\s*-\s*$/i, "") // Eliminar - ATX - al final
		.replace(/\s+-\s*P$/i, "") // Eliminar -P al final
		.replace(/\s+-\s*$/i, ""); // Eliminar guión al final

	// 2. Manejar formato SP Digital: "Marca Modelo, Specs..."
	// Dividir por coma y tomar la primera parte si parece un nombre de modelo
	if (normalized.includes(",")) {
		const parts = normalized.split(",");
		// Heurística: La primera parte es usualmente el nombre del modelo en SP Digital
		// ej. "GIGABYTE B650M GAMING WIFI"
		if (parts[0].length > 5) {
			normalized = parts[0].trim();
		}
	}

	// 3. Normalizar Capitalización de Marca
	const brands = [
		{ name: "ASUS", proper: "Asus" },
		{ name: "GIGABYTE", proper: "Gigabyte" },
		{ name: "MSI", proper: "MSI" },
		{ name: "ASROCK", proper: "ASRock" },
		{ name: "NZXT", proper: "NZXT" },
		{ name: "BIOSTAR", proper: "Biostar" },
		{ name: "EVGA", proper: "EVGA" },
	];

	let brandFound = false;
	for (const brand of brands) {
		const regex = new RegExp(`\\b${brand.name}\\b`, "i");
		if (regex.test(normalized)) {
			normalized = normalized.replace(regex, brand.proper);
			brandFound = true;
		}
	}

	// Si se proporciona fabricante y no se encuentra en el título, anteponerlo
	if (manufacturer && !brandFound) {
		const manuUpper = manufacturer.toUpperCase();
		const knownBrand = brands.find((b) => b.name === manuUpper);
		if (knownBrand) {
			normalized = `${knownBrand.proper} ${normalized}`;
		} else {
			// Capitalizar primera letra
			const properManu =
				manufacturer.charAt(0).toUpperCase() +
				manufacturer.slice(1).toLowerCase();
			normalized = `${properManu} ${normalized}`;
		}
	}

	// 4. Estandarizar WiFi
	normalized = normalized
		.replace(/\bWIFI\s*7\b/gi, "WiFi 7")
		.replace(/\bWF7\b/gi, "WiFi 7")
		.replace(/\bWIFI\s*6E\b/gi, "WiFi 6E")
		.replace(/\bWIFI\s*6\b/gi, "WiFi 6")
		.replace(/\bWIFI\b/gi, "WiFi") // Catch-all para WIFI restante
		.replace(/\bWi-Fi\b/gi, "WiFi");

	// 5. Eliminar sockets redundantes
	// Solo eliminar si son claramente prefijos/sufijos redundantes como sAM5, s1700
	normalized = normalized
		.replace(/\bsAM5\b/gi, "")
		.replace(/\bSAM5\b/gi, "")
		.replace(/\bsAM4\b/gi, "")
		.replace(/\bs1700\b/gi, "")
		.replace(/\bs1851\b/gi, "")
		.replace(/\bsFM2\+(?:\s|$)/gi, "")
		.replace(/\bSocket\s+AM5\b/gi, "")
		.replace(/\bSocket\s+AMD\s+AM5\b/gi, "")
		.replace(/\bSocket\s+LGA\s*1700\b/gi, "")
		.replace(/\bsLGA1700\b/gi, "") // Agregado sLGA1700
		.replace(/\bAM5\b/gi, ""); // Agregado AM5 (independiente)

	// 6. Estandarizar términos comunes y capitalización
	normalized = normalized
		.replace(/\bGAMING\b/i, "Gaming")
		.replace(/\bELITE\b/i, "Elite")
		.replace(/\bPRO\b/i, "Pro")
		.replace(/\bPLUS\b/i, "Plus")
		.replace(/\bMAX\b/i, "Max")
		.replace(/\bULTRA\b/i, "Ultra")
		.replace(/\bEXTREME\b/i, "Extreme")
		.replace(/\bMASTER\b/i, "Master")
		.replace(/\bHERO\b/i, "Hero")
		.replace(/\bSTRIX\b/i, "Strix")
		.replace(/\bTUF\b/i, "TUF")
		.replace(/\bPRIME\b/i, "Prime")
		.replace(/\bAORUS\b/i, "Aorus")
		.replace(/\bPHANTOM\b/i, "Phantom")
		.replace(/\bVELOCITA\b/i, "Velocita")
		.replace(/\bSTEEL LEGEND\b/i, "Steel Legend")
		.replace(/\bTAICHI\b/i, "Taichi")
		.replace(/\bCREATOR\b/i, "Creator")
		.replace(/\bPROART\b/i, "ProArt")
		.replace(/\bROG\b/i, "ROG")
		.replace(/\bMAG\b/i, "MAG")
		.replace(/\bMPG\b/i, "MPG")
		.replace(/\bMEG\b/i, "MEG")
		.replace(/\bTOMAHAWK\b/i, "Tomahawk")
		.replace(/\bMORTAR\b/i, "Mortar")
		.replace(/\bBAZOOKA\b/i, "Bazooka")
		.replace(/\bTORPEDO\b/i, "Torpedo")
		.replace(/\bEDGE\b/i, "Edge")
		.replace(/\bCARBON\b/i, "Carbon")
		.replace(/\bACE\b/i, "Ace")
		.replace(/\bUNIFY\b/i, "Unify")
		.replace(/\bGODLIKE\b/i, "Godlike")
		.replace(/\bICE\b/i, "ICE") // Asegurar ICE en mayúsculas
		.replace(/\bMICRO\s*ATX\b/gi, "Micro ATX")
		.replace(/\bMODULO DE SEGURIDAD TPM-SPI\b/gi, "TPM-SPI Module")
		.replace(/\bMODULO DE SEGURIDAD TPM-M R2.0\b/gi, "TPM-M R2.0 Module")
		.replace(/\bLIGHTNING\b/i, "Lightning") // Corregir capitalización LIGHTNING
		.replace(/\bICE-P\b/i, "ICE"); // Corregir sufijo ICE-P

	// 7. Estandarización de versiones
	normalized = normalized
		.replace(/\bv(\d+)\b/gi, "V$1")
		.replace(/\brev\s*(\d+(\.\d+)?)/gi, "Rev $1")
		.replace(/\bR2\.0\b/gi, "R2.0");

	// 8. Limpieza de espacios
	normalized = normalized.replace(/\s+/g, " ").trim();

	return normalized;
}
