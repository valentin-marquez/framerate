import type { PsuSpecs } from "@framerate/db";
import { PsuSchema } from "@framerate/db";
import { BaseExtractor, SYSTEM_PROMPT } from "@/strategies/base";

export class PsuStrategy extends BaseExtractor<PsuSpecs> {
  protected getZodSchema() {
    return PsuSchema as any;
  }

  protected async extractWithLLM(text: string, context?: any, lastError?: string) {
    const prompt = `PSU specs. Schema:\nTexto: ${text}${context ? `\nContext: ${JSON.stringify(context)}` : ""}${lastError ? `\n\nPrevious validation error: ${lastError}. Please correct the JSON and return ONLY valid JSON.` : ""}`;

    const completion = await this.callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    return JSON.parse(content) as PsuSpecs;
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
