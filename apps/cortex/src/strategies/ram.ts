import type { RamSpecs } from "@framerate/db";
import { RamSchema } from "@framerate/db";
import type { ZodType } from "zod";
import { BaseExtractor } from "@/strategies/base";

export class RamStrategy extends BaseExtractor<RamSpecs> {
  protected getZodSchema() {
    return RamSchema as unknown as ZodType<RamSpecs>;
  }

  async process(job: {
    raw_text?: string | null;
    mpn?: string;
    category?: string;
    context?: Record<string, unknown> | undefined;
  }) {
    const title = job.context?.title as string | undefined;
    const searchQuery = title ? `${title} specs` : job.mpn ? `${job.mpn} specs` : undefined;
    const specs = await this.extractWithRetry(`${job.raw_text ?? ""}`, job.context, 2, searchQuery);
    return {
      extracted: true,
      processed_at: new Date().toISOString(),
      mpn: job.mpn,
      category: job.category,
      specs,
    };
  }
}
