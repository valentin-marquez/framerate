import type { CpuCoolerSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class CpuCoolerIAExtractor extends BaseIAExtractor<CpuCoolerSpecs> {
  protected async extractWithLLM(
    text: string,
    // biome-ignore lint/suspicious/noExplicitAny: Context can be anything
    context?: any,
  ): Promise<CpuCoolerSpecs> {
    const prompt = `CPU Cooler specs. Schema:
{"manufacturer":"string","type":"Ventilador|Refrigeración líquida","fan_size":"X mm (radiador para AIO: 120|240|280|360 mm)","height":"X mm","weight":"X g|Desconocido","rpm":"X rpm o X-X rpm","airflow":"X CFM","noise_level":"X dB|Desconocido","has_heatpipes":boolean,"illumination":"RGB|ARGB|No","compatible_sockets":["AM4","AM5","LGA1700","LGA1851",etc]}

Marcas: Noctua, Cooler Master, be quiet!, Thermalright, DeepCool, Arctic, Corsair, NZXT, MSI, ASUS
AIO/Water Cooling/Líquida → type:"Refrigeración líquida", fan_size=radiador. Tower/Air → type:"Ventilador"
Tower coolers tienen heatpipes=true. AIO típicamente heatpipes=false.
Inferir sockets compatibles modernos si no especificados.

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

    return JSON.parse(content) as CpuCoolerSpecs;
  }
}
