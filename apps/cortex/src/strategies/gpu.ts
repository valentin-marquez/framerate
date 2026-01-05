import type { GpuSpecs } from "@framerate/db";
import { GpuSchema } from "@framerate/db";
import type { ZodType } from "zod";
import { BaseExtractor } from "@/strategies/base";

export class GpuStrategy extends BaseExtractor<GpuSpecs> {
  protected getZodSchema() {
    return GpuSchema as unknown as ZodType<GpuSpecs>;
  }

  async process(job: {
    raw_text?: string | null;
    normalized_title?: string | null;
    mpn?: string;
    category?: string;
    context?: Record<string, unknown> | undefined;
  }) {
    // Add normalized_title to context so extractWithRetry can find it
    const enhancedContext = { ...job.context, normalized_title: job.normalized_title };

    const title = job.normalized_title || (job.context?.title as string | undefined);
    const searchQuery = title ? `${title} specs` : job.mpn ? `${job.mpn} specs` : undefined;

    const specs = await this.extractWithRetry(
      `${job.raw_text ?? ""}`,
      enhancedContext,
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
