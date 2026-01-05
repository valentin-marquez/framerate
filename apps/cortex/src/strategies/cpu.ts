import type { CpuSpecs } from "@framerate/db";
import { CpuSchema } from "@framerate/db";
import type { ZodType } from "zod";
import { BaseExtractor } from "@/strategies/base";

export class CpuStrategy extends BaseExtractor<CpuSpecs> {
  protected getZodSchema() {
    return CpuSchema as unknown as ZodType<CpuSpecs>;
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
