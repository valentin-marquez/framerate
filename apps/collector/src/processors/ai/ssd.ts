import type { SsdSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class SsdIAExtractor extends BaseIAExtractor<SsdSpecs> {
  protected async extractWithLLM(text: string, context?: any): Promise<SsdSpecs> {
    const prompt = `SSD specs. Schema:
{"manufacturer":"string","line":"string","capacity":"X TB|GB","format":"M.2 2280|2.5\\"|M.2 2230","bus":"PCIe 3.0|4.0|5.0 NVMe|SATA 3 (6.0 Gb/s)","has_dram":boolean,"nand_type":"TLC|QLC|MLC","controller":"string","read_speed":"X MB/s","write_speed":"X MB/s"}

Marcas: Samsung, Kingston, Western Digital, Crucial, Corsair, ADATA, Sabrent
Líneas conocidas con DRAM: 980 Pro, SN850X, KC3000. Sin DRAM: NV2, SN570, A400
Inferir velocidades típicas si no están (SATA≈550/520, PCIe4≈7000/5000)
≥1000GB→TB

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

    return JSON.parse(content) as SsdSpecs;
  }
}
