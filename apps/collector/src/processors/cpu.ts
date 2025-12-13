import type { CpuSpecs } from "@framerate/db";

function parseCoolerIncluded(value?: string): boolean {
	if (!value) return false;
	const normalized = value.toLowerCase().trim();

	if (
		normalized === "no" ||
		normalized === "no posee" ||
		normalized === "false" ||
		normalized === ""
	) {
		return false;
	}

	return (
		normalized === "sí" ||
		normalized === "si" ||
		normalized === "yes" ||
		normalized === "true" ||
		normalized.includes("incluido") ||
		normalized.includes("incluye")
	);
}

export const CpuProcessor = {
	normalize(rawSpecs: Record<string, string>): CpuSpecs {
		const frequency =
			rawSpecs.frequency ||
			rawSpecs.frecuencia ||
			rawSpecs["frecuencia del procesador"] ||
			"";
		const frequencyTurbo =
			rawSpecs.frequency_turbo ||
			rawSpecs.frecuencia_turbo ||
			rawSpecs.frecuencia_turbo_máxima ||
			rawSpecs["frecuencia del procesador turbo"] ||
			"";

		const cores =
			rawSpecs.cores ||
			rawSpecs.núcleos ||
			rawSpecs["número de núcleos de procesador"] ||
			"";
		const threads =
			rawSpecs.threads ||
			rawSpecs.hilos ||
			rawSpecs["número de hilos de ejecución"] ||
			"";
		let coresThreads = rawSpecs.cores_threads || "";

		if (!coresThreads && (cores || threads)) {
			const coresPart = cores ? `${cores}` : "";
			const threadsPart = threads ? ` / ${threads}` : "";
			coresThreads = `${coresPart}${threadsPart}`.trim();
		}

		return {
			manufacturer:
				rawSpecs.manufacturer ||
				rawSpecs.fabricante ||
				rawSpecs["familia de procesador"] ||
				"",
			frequency,
			frequency_turbo: frequencyTurbo,
			cores_threads: coresThreads,
			cache:
				rawSpecs.cache ||
				rawSpecs.caché ||
				rawSpecs["memoria caché"] ||
				rawSpecs["caché del procesador"] ||
				"",
			socket:
				rawSpecs.socket ||
				rawSpecs.enchufe ||
				rawSpecs.zócalo ||
				rawSpecs["socket de procesador"] ||
				"",
			core_name: rawSpecs.core_name || rawSpecs.núcleo || "",
			manufacturing_process:
				rawSpecs.manufacturing_process ||
				rawSpecs.proceso_de_manufactura ||
				rawSpecs["proceso de manufactura"] ||
				rawSpecs["litografía del procesador"] ||
				"",
			tdp:
				rawSpecs.tdp ||
				rawSpecs.consumo ||
				rawSpecs["potencia de diseño térmico (tdp)"] ||
				"",
			cooler_included: parseCoolerIncluded(
				rawSpecs.cooler_included ||
					rawSpecs["¿incluye_cooler?"] ||
					rawSpecs.incluye_cooler ||
					rawSpecs["refrigerador incluido"],
			),
			integrated_graphics:
				rawSpecs.integrated_graphics ||
				rawSpecs.gráficos_integrados ||
				rawSpecs.graficos_integrados ||
				rawSpecs["modelo de adaptador gráfico incorporado"] ||
				"",
		};
	},
};
