import type { RamSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class RamIAExtractor extends BaseIAExtractor<RamSpecs> {
  protected async extractWithLLM(text: string, context?: any): Promise<RamSpecs> {
    const prompt = `RAM specs. Schema:
{"manufacturer":"string","capacity":"N x X GB","type":"DDR4|DDR5|LPDDR5","speed":"X MT/s o MHz","format":"DIMM|SO-DIMM","voltage":"X V","latency_cl":"número","latency_trcd":"número|Desconocida","latency_trp":"número|Desconocida","latency_tras":"número|Desconocida","ecc_support":boolean,"full_buffered":boolean}

Marcas: Kingston, Corsair, G.Skill, ADATA, Crucial, TeamGroup, Patriot
Kit 32GB (2x16GB) → capacity: "2 x 16 GB"
Latencias CL16-20-20-38 → cl:16, trcd:20, trp:20, tras:38
UDIMM→DIMM, SODIMM→SO-DIMM. ECC solo si explícito.

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

    return JSON.parse(content) as RamSpecs;
  }
}
