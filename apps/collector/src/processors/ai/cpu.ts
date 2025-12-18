import type { CpuSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class CpuIAExtractor extends BaseIAExtractor<CpuSpecs> {
  protected async extractWithLLM(
    text: string,
    // biome-ignore lint/suspicious/noExplicitAny: Context can be anything
    context?: any,
  ): Promise<CpuSpecs> {
    const prompt = `CPU specs. Schema:
{"manufacturer":"AMD|Intel","frequency":"X GHz","frequency_turbo":"X GHz","cores_threads":"X núcleos / X hilos","cache":"X MB L3","socket":"AM4|AM5|LGA1700|etc","core_name":"Zen X|Raptor Lake|etc","manufacturing_process":"Xnm","tdp":"XW","cooler_included":boolean,"integrated_graphics":"AMD Radeon Graphics|Intel UHD X|No posee"}

Inferir specs conocidas del modelo (ej: Ryzen 7 9700X = Zen 5, 4nm, AM5, 65W).
K/KF/X sin cooler. F/KF sin iGPU. BOX con cooler.

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

    return JSON.parse(content) as CpuSpecs;
  }
}
