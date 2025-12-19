import type { HddSpecs } from "@framerate/db";
import { HddSchema } from "@framerate/db";
import { BaseExtractor, SYSTEM_PROMPT } from "@/strategies/base";

export class HddStrategy extends BaseExtractor<HddSpecs> {
  protected getZodSchema() {
    return HddSchema as any;
  }

  protected async extractWithLLM(text: string, context?: any, lastError?: string) {
    const prompt = `HDD specs. Schema:\nTexto: ${text}${context ? `\nContext: ${JSON.stringify(context)}` : ""}${lastError ? `\n\nPrevious validation error: ${lastError}. Please correct the JSON and return ONLY valid JSON.` : ""}`;

    const completion = await this.callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    return JSON.parse(content) as HddSpecs;
  }

  async process(job: any) {
    const specs = await this.extractWithRetry(`Title: ${job.raw_text ?? ""}`, job.context);
    return {
      extracted: true,
      processed_at: new Date().toISOString(),
      mpn: job.mpn,
      category: job.category,
      specs,
    };
  }
}
