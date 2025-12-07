import type { CaseFanSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class CaseFanIAExtractor extends BaseIAExtractor<CaseFanSpecs> {
  protected async extractWithLLM(
    text: string,
    // biome-ignore lint/suspicious/noExplicitAny: Context can be anything
    context?: any,
  ): Promise<CaseFanSpecs> {
    const prompt = `Case Fan specs. Schema:
{"manufacturer":"string","size":"X mm","rpm":"X RPM o X-X RPM","airflow":"X CFM","static_pressure":"X mm H2O","noise_level":"X dBA","illumination":"RGB|ARGB|No","lighting_control":"Software|Motherboard Sync|No posee","bearing":"Fluid Dynamic|Hydraulic|Sleeve|Ball|MagLev","fans_included":"número","includes_hub":boolean,"power_connectors":["4-pin PWM","3-pin ARGB",etc]}

Marcas: Corsair, Cooler Master, Noctua, Arctic, be quiet!, Lian Li, NZXT, Thermaltake, DeepCool
Pack/Kit = fans_included > 1. Con hub/controller = includes_hub: true
Inferir specs conocidas del modelo (ej: NF-A12 = 120mm, SSO2, 1500rpm)

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

    return JSON.parse(content) as CaseFanSpecs;
  }
}
