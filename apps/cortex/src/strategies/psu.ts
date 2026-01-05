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
