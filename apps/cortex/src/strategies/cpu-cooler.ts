import type { CpuCoolerSpecs } from "@framerate/db";
import { CpuCoolerSchema } from "@framerate/db";
import type { ZodType } from "zod";
import { BaseExtractor } from "@/strategies/base";

export class CpuCoolerStrategy extends BaseExtractor<CpuCoolerSpecs> {
  protected getZodSchema() {
    return CpuCoolerSchema as unknown as ZodType<CpuCoolerSpecs>;
  }

  async process(job: {
    raw_text?: string | null;
    mpn?: string;
    category?: string;
    context?: Record<string, unknown> | undefined;
  }) {
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
