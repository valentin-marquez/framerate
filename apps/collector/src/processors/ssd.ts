import type { SsdSpecs } from "@framerate/db";

function extractCapacityFromTitle(title: string): string {
	const tbMatch = title.match(/(\d+(?:\.\d+)?)\s*TB/i);
	if (tbMatch) {
		return `${tbMatch[1]} TB`;
	}

	const gbMatch = title.match(/(\d+)\s*GB/i);
	if (gbMatch) {
		const gb = Number.parseInt(gbMatch[1], 10);
		if (gb >= 1000) {
			return `${gb / 1000} TB`;
		}
		return `${gb} GB`;
	}

	return "";
}

function extractFormatFromTitle(title: string): string {
	const titleUpper = title.toUpperCase();

	if (titleUpper.includes("M.2 2280") || titleUpper.includes("M2 2280")) {
		return "M.2 2280";
	}
	if (titleUpper.includes("M.2 2230") || titleUpper.includes("M2 2230")) {
		return "M.2 2230";
	}
	if (titleUpper.includes("M.2 2242") || titleUpper.includes("M2 2242")) {
		return "M.2 2242";
	}

	if (titleUpper.includes("U.2") || titleUpper.includes("U2")) {
		return "U.2";
	}

	if (
		titleUpper.includes('2.5"') ||
		titleUpper.includes("2.5''") ||
		titleUpper.includes("2,5")
	) {
		return '2.5"';
	}
	if (
		titleUpper.includes("SSD 2.5") ||
		(titleUpper.includes("SOLIDO") &&
			!titleUpper.includes("M.2") &&
			!titleUpper.includes("NVME"))
	) {
		return '2.5"';
	}

	if (titleUpper.includes("M.2") || titleUpper.includes("M2")) {
		return "M.2";
	}

	return "";
}

function extractBusFromTitle(title: string): string {
	const titleUpper = title.toUpperCase();

	if (
		titleUpper.includes("PCIE 5.0") ||
		titleUpper.includes("PCIE G5") ||
		titleUpper.includes("PCIE5") ||
		titleUpper.includes("PCI EXPRESS 5.0") ||
		titleUpper.includes("PCI-EXPRESS 5.0") ||
		titleUpper.includes("PCIE 5")
	) {
		return "PCIe 5.0 NVMe";
	}

	if (
		titleUpper.includes("PCIE 4.0") ||
		titleUpper.includes("PCIE G4") ||
		titleUpper.includes("PCIE4") ||
		titleUpper.includes("PCIE 4") ||
		titleUpper.includes("PCI EXPRESS 4.0") ||
		titleUpper.includes("PCI-EXPRESS 4.0")
	) {
		return "PCIe 4.0 NVMe";
	}

	if (
		titleUpper.includes("PCIE 3.0") ||
		titleUpper.includes("PCIE G3") ||
		titleUpper.includes("PCIE3") ||
		titleUpper.includes("PCI EXPRESS 3.0") ||
		titleUpper.includes("PCI-EXPRESS 3.0")
	) {
		return "PCIe 3.0 NVMe";
	}

	if (titleUpper.includes("NVME")) {
		return "PCIe NVMe";
	}

	if (titleUpper.includes("SATA")) {
		return "SATA 3 (6.0 Gb/s)";
	}

	if (
		titleUpper.includes('2.5"') ||
		titleUpper.includes("2.5''") ||
		titleUpper.includes("SSD 2.5")
	) {
		return "SATA 3 (6.0 Gb/s)";
	}

	return "";
}

function extractSpeedsFromTitle(title: string): {
	read: string;
	write: string;
} {
	const slashMatch = title.match(/(\d{3,5})\s*\/\s*(\d{3,5})\s*MB\/S/i);
	if (slashMatch) {
		return {
			read: `${slashMatch[1]} MB/s`,
			write: `${slashMatch[2]} MB/s`,
		};
	}

	const dashMatch = title.match(/(\d{3,5})\s*-\s*(\d{3,5})\s*MB\/S/i);
	if (dashMatch) {
		return {
			read: `${dashMatch[1]} MB/s`,
			write: `${dashMatch[2]} MB/s`,
		};
	}

	const upToMatch = title.match(/Up\s*to\s*(\d{3,5})\s*\/\s*(\d{3,5})\s*MB/i);
	if (upToMatch) {
		return {
			read: `${upToMatch[1]} MB/s`,
			write: `${upToMatch[2]} MB/s`,
		};
	}

	const singleMatch = title.match(/(\d{4,5})\s*MB\/S/i);
	if (singleMatch) {
		return {
			read: `${singleMatch[1]} MB/s`,
			write: "",
		};
	}

	return { read: "", write: "" };
}

function extractLineFromTitle(title: string): string {
	const titleUpper = title.toUpperCase();

	// Kingston lines
	if (titleUpper.includes("NV3")) return "Kingston NV3";
	if (titleUpper.includes("NV2")) return "Kingston NV2";
	if (titleUpper.includes("NV1")) return "Kingston NV1";
	if (titleUpper.includes("A400")) return "Kingston A400";
	if (titleUpper.includes("KC3000")) return "Kingston KC3000";
	if (titleUpper.includes("FURY RENEGADE")) return "Kingston Fury Renegade";
	if (titleUpper.includes("DC600M")) return "Kingston DC600M";
	if (titleUpper.includes("DC3000ME")) return "Kingston DC3000ME";

	if (titleUpper.includes("990 PRO")) return "Samsung 990 Pro";
	if (titleUpper.includes("980 PRO")) return "Samsung 980 Pro";
	if (titleUpper.includes("970 EVO")) return "Samsung 970 EVO";
	if (titleUpper.includes("870 EVO")) return "Samsung 870 EVO";
	if (titleUpper.includes("860 EVO")) return "Samsung 860 EVO";
	if (titleUpper.includes("870 QVO")) return "Samsung 870 QVO";

	if (titleUpper.includes("SN8100")) return "WD Black SN8100";
	if (titleUpper.includes("SN850X")) return "WD Black SN850X";
	if (titleUpper.includes("SN850")) return "WD Black SN850";
	if (titleUpper.includes("SN770")) return "WD Black SN770";
	if (titleUpper.includes("SN7100")) return "WD Black SN7100";
	if (titleUpper.includes("SN580")) return "WD Blue SN580";
	if (titleUpper.includes("SN570")) return "WD Blue SN570";
	if (titleUpper.includes("SN5000")) return "WD Blue SN5000";
	if (titleUpper.includes("WD BLUE")) return "WD Blue";
	if (titleUpper.includes("WD GREEN")) return "WD Green";
	if (titleUpper.includes("WD BLACK")) return "WD Black";

	if (titleUpper.includes("P5 PLUS")) return "Crucial P5 Plus";
	if (titleUpper.includes("P3 PLUS")) return "Crucial P3 Plus";
	if (titleUpper.includes("MX500")) return "Crucial MX500";
	if (titleUpper.includes("BX500")) return "Crucial BX500";

	if (titleUpper.includes("SU650") || titleUpper.includes("ULTIMATE SU650"))
		return "ADATA Ultimate SU650";
	if (titleUpper.includes("SU800")) return "ADATA Ultimate SU800";
	if (titleUpper.includes("XPG GAMMIX S70")) return "ADATA XPG Gammix S70";
	if (titleUpper.includes("XPG GAMMIX S50")) return "ADATA XPG Gammix S50";
	if (titleUpper.includes("LEGEND 960")) return "ADATA Legend 960";
	if (titleUpper.includes("LEGEND 850")) return "ADATA Legend 850";

	if (titleUpper.includes("FIRECUDA 530")) return "Seagate FireCuda 530";
	if (titleUpper.includes("FIRECUDA 520")) return "Seagate FireCuda 520";
	if (titleUpper.includes("BARRACUDA")) return "Seagate BarraCuda SSD";

	return "";
}

function inferBusFromSpeed(readSpeed: string): string {
	const speedMatch = readSpeed.match(/(\d+)/);
	if (!speedMatch) return "";

	const speed = Number.parseInt(speedMatch[1], 10);

	if (speed >= 10000) return "PCIe 5.0 NVMe";
	if (speed >= 5000) return "PCIe 4.0 NVMe";
	if (speed >= 2000) return "PCIe 3.0 NVMe";
	if (speed >= 600) return "PCIe NVMe";

	return "";
}

export const SsdProcessor = {
	normalize(rawSpecs: Record<string, string>, title = ""): SsdSpecs {
		const titleCapacity = extractCapacityFromTitle(title);
		const titleFormat = extractFormatFromTitle(title);
		let titleBus = extractBusFromTitle(title);
		const titleSpeeds = extractSpeedsFromTitle(title);
		const titleLine = extractLineFromTitle(title);

		if (titleBus === "PCIe NVMe" && titleSpeeds.read) {
			const inferredBus = inferBusFromSpeed(titleSpeeds.read);
			if (inferredBus) {
				titleBus = inferredBus;
			}
		}

		// Mapear campos de SP Digital a campos normalizados
		// SP Digital: "Memoria caché DDR externa" -> has_dram
		const hasDramValue =
			rawSpecs.has_dram ||
			rawSpecs["¿posee dram?"] ||
			rawSpecs.posee_dram ||
			rawSpecs["Memoria caché DDR externa"] ||
			"";
		const hasDram =
			hasDramValue.toLowerCase() === "sí" ||
			hasDramValue.toLowerCase() === "si" ||
			hasDramValue.toLowerCase() === "yes" ||
			hasDramValue.toLowerCase() === "true";

		// SP Digital: "Interfaz" + "NVMe" -> bus
		const spDigitalInterface = rawSpecs.Interfaz || rawSpecs.interfaz || "";
		const spDigitalNvme = rawSpecs.NVMe || rawSpecs.nvme || "";
		let busFromSpDigital = "";
		if (spDigitalInterface) {
			if (
				spDigitalInterface.includes("5.0") ||
				spDigitalInterface.includes("5")
			) {
				busFromSpDigital =
					spDigitalNvme.toLowerCase() === "si" ? "PCIe 5.0 NVMe" : "PCIe 5.0";
			} else if (
				spDigitalInterface.includes("4.0") ||
				spDigitalInterface.includes("4")
			) {
				busFromSpDigital =
					spDigitalNvme.toLowerCase() === "si" ? "PCIe 4.0 NVMe" : "PCIe 4.0";
			} else if (
				spDigitalInterface.includes("3.0") ||
				spDigitalInterface.includes("3")
			) {
				busFromSpDigital =
					spDigitalNvme.toLowerCase() === "si" ? "PCIe 3.0 NVMe" : "PCIe 3.0";
			} else if (spDigitalInterface.toUpperCase().includes("SATA")) {
				busFromSpDigital = "SATA 3 (6.0 Gb/s)";
			}
		}

		// SP Digital: "Factor de forma de disco SSD" + "Tamaño de la unidad SSD M.2" -> format
		const spDigitalFormFactor =
			rawSpecs["Factor de forma de disco SSD"] ||
			rawSpecs["factor de forma de disco ssd"] ||
			"";
		const spDigitalM2Size =
			rawSpecs["Tamaño de la unidad SSD M.2"] ||
			rawSpecs["tamaño de la unidad ssd m.2"] ||
			"";
		let formatFromSpDigital = "";
		if (spDigitalFormFactor.toUpperCase().includes("M.2") && spDigitalM2Size) {
			// Extract the size like "2280" from "2280 (22 x 80 mm)"
			const sizeMatch = spDigitalM2Size.match(/(\d{4})/);
			if (sizeMatch) {
				formatFromSpDigital = `M.2 ${sizeMatch[1]}`;
			} else {
				formatFromSpDigital = "M.2";
			}
		} else if (
			spDigitalFormFactor.includes("2.5") ||
			spDigitalFormFactor.includes("2,5")
		) {
			formatFromSpDigital = '2.5"';
		}

		// SP Digital: "Tipo de memoria" -> nand_type (e.g., "3D TLC")
		const spDigitalNandType =
			rawSpecs["Tipo de memoria"] || rawSpecs["tipo de memoria"] || "";

		// SP Digital: "SDD, capacidad" -> capacity (e.g., "2,05 TB")
		const spDigitalCapacity =
			rawSpecs["SDD, capacidad"] || rawSpecs["sdd, capacidad"] || "";
		let capacityFromSpDigital = "";
		if (spDigitalCapacity) {
			// Normalize "2,05 TB" to "2 TB" or "512 GB"
			const capacityNormalized = spDigitalCapacity.replace(",", ".");
			const tbMatch = capacityNormalized.match(/([\d.]+)\s*TB/i);
			const gbMatch = capacityNormalized.match(/([\d.]+)\s*GB/i);
			if (tbMatch) {
				const tb = Number.parseFloat(tbMatch[1]);
				capacityFromSpDigital =
					tb >= 1 ? `${Math.round(tb)} TB` : `${Math.round(tb * 1000)} GB`;
			} else if (gbMatch) {
				capacityFromSpDigital = `${Math.round(Number.parseFloat(gbMatch[1]))} GB`;
			}
		}

		// SP Digital: "Velocidad de lectura" and "Velocidad de escritura"
		const spDigitalReadSpeed =
			rawSpecs["Velocidad de lectura"] ||
			rawSpecs["velocidad de lectura"] ||
			"";
		const spDigitalWriteSpeed =
			rawSpecs["Velocidad de escritura"] ||
			rawSpecs["velocidad de escritura"] ||
			"";

		let finalBus = rawSpecs.bus || busFromSpDigital || titleBus || "";
		const finalReadSpeed =
			rawSpecs.read_speed ||
			rawSpecs.lectura_secuencial ||
			rawSpecs["lectura secuencial (según fabricante)"] ||
			spDigitalReadSpeed ||
			titleSpeeds.read ||
			"";

		if (
			(finalBus === "NVMe" || finalBus === "PCIe NVMe" || !finalBus) &&
			finalReadSpeed
		) {
			const inferredBus = inferBusFromSpeed(finalReadSpeed);
			if (inferredBus) {
				finalBus = inferredBus;
			}
		}

		return {
			manufacturer:
				rawSpecs.manufacturer ||
				rawSpecs.brand ||
				rawSpecs.fabricante ||
				rawSpecs.marca ||
				"",
			line:
				rawSpecs.line || rawSpecs.linea || rawSpecs.línea || titleLine || "",
			capacity:
				rawSpecs.capacity ||
				rawSpecs.capacidad ||
				capacityFromSpDigital ||
				titleCapacity ||
				"",
			format:
				rawSpecs.format ||
				rawSpecs.formato ||
				formatFromSpDigital ||
				titleFormat ||
				"",
			bus: finalBus,
			has_dram: hasDram,
			nand_type:
				rawSpecs.nand_type ||
				rawSpecs.tipo_memoria_nand ||
				rawSpecs["tipo memoria nand"] ||
				spDigitalNandType ||
				"",
			controller: rawSpecs.controller || rawSpecs.controladora || "",
			read_speed: finalReadSpeed,
			write_speed:
				rawSpecs.write_speed ||
				rawSpecs.escritura_secuencial ||
				rawSpecs["escritura secuencial (según fabricante)"] ||
				spDigitalWriteSpeed ||
				titleSpeeds.write ||
				"",
		};
	},
};
