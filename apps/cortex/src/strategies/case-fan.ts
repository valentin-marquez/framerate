import type { CaseFanSpecs } from "@framerate/db";
import { CaseFanSchema } from "@framerate/db";
import type { ZodType } from "zod";
import { BaseExtractor } from "@/strategies/base";

export class CaseFanStrategy extends BaseExtractor<CaseFanSpecs> {
  protected getZodSchema() {
    return CaseFanSchema as unknown as ZodType<CaseFanSpecs>;
  }

  async process(job: {
    raw_text?: string | null;
    mpn?: string;
    category?: string;
    context?: Record<string, unknown> | undefined;
  }) {
    const title = job.context?.title as string | undefined;
    const searchQuery = title ? `${title} specs` : job.mpn ? `${job.mpn} specs` : undefined;
    const specs = await this.extractWithRetry(
      `${job.raw_text ?? ""}`,
      job.context,
      2,
      searchQuery,
      job.category,
      job.mpn,
    );
    return {
      extracted: true,
      processed_at: new Date().toISOString(),
      mpn: job.mpn,
      category: job.category,
      specs,
    };
  }
}
