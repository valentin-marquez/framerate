import type { MotherboardSpecs } from "@framerate/db";
import { MotherboardSchema } from "@framerate/db";
import type { ZodType } from "zod";
import { BaseExtractor } from "@/strategies/base";

export class MotherboardStrategy extends BaseExtractor<MotherboardSpecs> {
  protected getZodSchema() {
    return MotherboardSchema as unknown as ZodType<MotherboardSpecs>;
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
