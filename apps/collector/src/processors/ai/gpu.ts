import type { GpuSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class GpuIAExtractor extends BaseIAExtractor<GpuSpecs> {
  protected async extractWithLLM(
    text: string,
    // biome-ignore lint/suspicious/noExplicitAny: Context can be anything
    context?: any,
  ): Promise<GpuSpecs> {
    const prompt = `GPU specs. Schema:
{"manufacturer":"string","gpu_model":"string","memory":"X GB GDDRX (X bit)","bus":"PCI Express X.0 xX","frequencies":"X MHz","memory_frequency":"X Gbps","core":"string","profile":"Normal|Low Profile","cooling":"Ventilador|Refrigeración líquida|Pasiva","slots":"X slot","length":"X mm","illumination":"RGB|ARGB|No posee","backplate":boolean,"power_connectors":["Nx type"],"video_ports":["Nx type"]}

Marcas: ASUS, MSI, Gigabyte, Zotac, EVGA, PNY, Sapphire, PowerColor, XFX, ASRock
gpu_model: incluir marca GPU (NVIDIA GeForce/AMD Radeon/Intel Arc) + modelo completo

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

    return JSON.parse(content) as GpuSpecs;
  }
}
