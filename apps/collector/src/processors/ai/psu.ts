import type { PsuSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class PsuIAExtractor extends BaseIAExtractor<PsuSpecs> {
  protected async extractWithLLM(
    text: string,
    // biome-ignore lint/suspicious/noExplicitAny: Context can be anything
    context?: any,
  ): Promise<PsuSpecs> {
    const prompt = `PSU specs. Schema:
{"manufacturer":"string","wattage":"XW","certification":"80 Plus White|Bronze|Silver|Gold|Platinum|Titanium|No posee","form_factor":"ATX|SFX|SFX-L|TFX","pfc_active":boolean,"modular":"Full Modular|Semi Modular|No","rail_12v":"X A","rail_5v":"X A","rail_3v3":"X A","power_connectors":["Nx type"]}

Marcas: Corsair, EVGA, Seasonic, Thermaltake, Cooler Master, be quiet!, NZXT, Gamemax, DeepCool
Conectores formato: "1x 24-pin ATX", "2x 8-pin CPU", "4x 6+2-pin PCIe", "1x 16-pin 12VHPWR", "Nx SATA"
80 Plus moderno = pfc_active: true

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

    return JSON.parse(content) as PsuSpecs;
  }
}
