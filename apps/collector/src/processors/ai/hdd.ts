import type { HddSpecs } from "@framerate/db";
import { BaseIAExtractor, SYSTEM_PROMPT } from "./base";

export class HddIAExtractor extends BaseIAExtractor<HddSpecs> {
  protected async extractWithLLM(
    text: string,
    // biome-ignore lint/suspicious/noExplicitAny: Context can be anything
    context?: any,
  ): Promise<HddSpecs> {
    const prompt = `HDD specs. Schema:
{"manufacturer":"string","type":"HDD","line":"string","capacity":"X TB|GB","rpm":"X rpm","size":"3.5\\" o 2.5\\"","bus":"SATA 3 (6.0 Gb/s)|SAS","buffer":"X MB"}

Marcas: Western Digital (WD→Western Digital), Seagate, Toshiba, Hitachi (HGST→Hitachi)
Líneas: Purple, Blue, Gold, Red, SkyHawk, BarraCuda, IronWolf, Exos
≥1000GB → TB. Desktop=3.5", Laptop=2.5". SATA III→SATA 3 (6.0 Gb/s)

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

    return JSON.parse(content) as HddSpecs;
  }
}
