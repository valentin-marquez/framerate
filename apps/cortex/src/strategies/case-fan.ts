import type { CaseFanSpecs } from "@framerate/db";
import { CaseFanSchema } from "@framerate/db";
import { BaseExtractor, SYSTEM_PROMPT } from "@/strategies/base";

export class CaseFanStrategy extends BaseExtractor<CaseFanSpecs> {
  protected getZodSchema() {
    return CaseFanSchema as any;
  }

  protected async extractWithLLM(text: string, context?: any, lastError?: string) {
    const prompt = `Case Fan specs. Schema:\nTexto: ${text}${context ? `\nContext: ${JSON.stringify(context)}` : ""}${lastError ? `\n\nPrevious validation error: ${lastError}. Please correct the JSON and return ONLY valid JSON.` : ""}`;

    const completion = await this.callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    return JSON.parse(content) as CaseFanSpecs;
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
