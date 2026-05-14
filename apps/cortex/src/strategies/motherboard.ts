import type { MotherboardSpecs } from "@framerate/db";
import { MotherboardSchema } from "@framerate/db";
import { BaseExtractor } from "@/strategies/base";

export class MotherboardStrategy extends BaseExtractor<MotherboardSpecs> {
  protected getZodSchema() {
    return MotherboardSchema;
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
    const { specs, foundMpn } = await this.extractWithRetry(
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
      mpn: foundMpn || job.mpn,
      category: job.category,
      specs,
    };
  }
}
