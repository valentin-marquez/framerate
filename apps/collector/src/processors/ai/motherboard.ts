import type { MotherboardSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class MotherboardIAExtractor extends BaseIAExtractor<MotherboardSpecs> {
	protected async extractWithLLM(
		text: string,
		// biome-ignore lint/suspicious/noExplicitAny: Context can be anything
		context?: any,
	): Promise<MotherboardSpecs> {
		const prompt = `Motherboard specs. Schema:
{"manufacturer":"string","socket":"LGA 1700|AM5|AM4|etc","chipset":"Intel/AMD + modelo","memory_slots":"Nx DDRx","memory_channels":"Dual channel|Quad channel","form_factor":"ATX|Micro ATX|Mini ITX|E-ATX","rgb_support":["headers"],"video_ports":["ports"],"power_connectors":["connectors"],"integrated_graphics":"Redirige gráficos del procesador|No posee","sli_support":boolean,"crossfire_support":boolean,"raid_support":boolean,"storage_connectors":["M.2/SATA"],"io_ports":["USB/Ethernet/Audio"],"expansion_slots":["PCIe slots"]}

Marcas: ASUS, Gigabyte, MSI, ASRock, Biostar, NZXT
Si tiene puertos video → integrated_graphics: "Redirige gráficos del procesador"
Inferir specs del chipset (ej: B650 = AM5, DDR5, PCIe 4.0)

Texto: ${text}${context ? `\nContext: ${JSON.stringify(context)}` : ""}`;

		const completion = await this.callLLM({
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: prompt },
			],
			model: this.model,
			response_format: { type: "json_object" },
			temperature: 0.1,
		});
		const content = completion.choices[0].message.content;
		if (!content) {
			throw new Error("Failed to get response from LLM");
		}

		return JSON.parse(content) as MotherboardSpecs;
	}
}
