import type { CaseSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class CaseIAExtractor extends BaseIAExtractor<CaseSpecs> {
  protected async extractWithLLM(
    text: string,
    // biome-ignore lint/suspicious/noExplicitAny: Context can be anything
    context?: any,
  ): Promise<CaseSpecs> {
    const prompt = `Case/Gabinete specs. Schema:
{"manufacturer":"string","max_motherboard_size":"ATX|Micro ATX|Mini ITX|E-ATX","psu_included":"No posee|XW","side_panel":"Vidrio templado|Acrílico|Sólido","color":"Negro|Blanco|etc","illumination":"RGB|ARGB|No","dimensions":"X x X x X mm","max_gpu_length":"X mm","max_cooler_height":"X mm","weight":"X kg","psu_position":"Inferior|Superior|Lateral","expansion_slots":"número","front_ports":["Nx USB X.X","USB-C"],"drive_bays":["5¼ externas: X","3½ internas: X","2½ internas: X"],"front_fans":"Nx X mm","rear_fans":"Nx X mm","side_fans":"Nx X mm|No posee","top_fans":"Nx X mm","bottom_fans":"Nx X mm|No posee","included_fans":"Nx Xmm tipo|No posee"}

Marcas: Corsair, NZXT, Lian Li, Fractal Design, Cooler Master, Phanteks, Thermaltake, Gamemax, DeepCool
Inferir specs conocidas del modelo. Torre Mid=ATX, Mini Tower=mATX, ITX=Mini ITX.

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

    return JSON.parse(content) as CaseSpecs;
  }
}
