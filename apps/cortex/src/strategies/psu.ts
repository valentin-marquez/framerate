import type { PsuSpecs } from "@framerate/db";
import { PsuSchema } from "@framerate/db";
import type { ZodType } from "zod";
import { BaseExtractor } from "@/strategies/base";

export class PsuStrategy extends BaseExtractor<PsuSpecs> {
  protected getZodSchema() {
    return PsuSchema as unknown as ZodType<PsuSpecs>;
  }

  async process(job: {
    raw_text?: string | null;
    mpn?: string;
    category?: string;
    context?: Record<string, unknown> | undefined;
  }) {
    const specs = await this.extractWithRetry(`${job.raw_text ?? ""}`, job.context);
    return {
      extracted: true,
      processed_at: new Date().toISOString(),
      mpn: job.mpn,
      category: job.category,
      specs,
    };
  }
}
