import type { PipelineContext, ProductPipeline } from "@/collector/pipelines/product.pipeline";
import type { CategorySlug } from "@/collector/services/catalog.service";
import type { BaseCrawler } from "@/crawlers/base";
import { Logger } from "@/lib/logger";
import type { CollectorJobData } from "@/queues";
import type { JobResult, JobStrategy } from "./base.strategy";

export class ScraperStrategy<T extends string> implements JobStrategy {
  private logger = new Logger("ScraperStrategy");

  constructor(
    private crawler: BaseCrawler & {
      getAllProductUrlsForCategory: (cat: T) => Promise<string[]>;
      CATEGORIES?: Record<T, unknown>;
      slug?: string;
    },
    private pipeline: ProductPipeline,
    private batchSize = 4,
  ) {}

  async execute(job: CollectorJobData): Promise<JobResult> {
    const startTime = Date.now();

    const meta = this.crawler as unknown as { CATEGORIES?: Record<T, unknown>; slug?: string };
    const categoriesToProcess: T[] =
      job.category === "all" || !job.category
        ? (Object.keys(meta.CATEGORIES ?? {}) as T[])
        : ([job.category as unknown as T] as T[]);

    const results: Record<string, number> = {};
    let totalProcessed = 0;

    for (const category of categoriesToProcess) {
      this.logger.info(`Processing category ${category}`);

      const urls = await this.crawler.getAllProductUrlsForCategory(category);
      this.logger.info(`Found ${urls.length} product URLs for ${category}`);
      if (!urls.length) {
        results[category] = 0;
        continue;
      }

      const storeId = await this.pipeline.getCatalogService().getStoreId(meta.slug ?? "");
      if (!storeId) {
        this.logger.error(`Store '${meta.slug ?? ""}' not found`);
        results[category] = 0;
        continue;
      }

      let processed = 0;
      const totalBatches = Math.ceil(urls.length / this.batchSize);

      for (let i = 0; i < urls.length; i += this.batchSize) {
        const batch = urls.slice(i, i + this.batchSize);
        const batchNumber = Math.floor(i / this.batchSize) + 1;

        this.logger.info(`[${category}] Batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

        const htmlResults = await this.crawler.fetchHtmlBatch(batch);

        const promises = batch.map(async (url) => {
          const html = htmlResults.get(url);
          if (!html) return false;
          try {
            const product = await this.crawler.parseProduct(html, url);
            if (!product) return false;

            const ctx: PipelineContext = {
              category: category as unknown as CategorySlug,
              storeId,
              crawlerType: job.crawler,
            };
            const res = await this.pipeline.process(product, ctx);
            return res.success;
          } catch (err) {
            this.logger.warn("Failed processing", (err as Error).message || String(err));
            return false;
          }
        });

        const settled = await Promise.all(promises);
        const successCount = settled.filter(Boolean).length;
        processed += successCount;

        this.logger.info(
          `[${category}] Batch ${batchNumber}: ${successCount}/${batch.length} | Total: ${processed}/${urls.length}`,
        );
      }

      results[category] = processed;
      totalProcessed += processed;
    }

    const duration = (Date.now() - startTime) / 1000;
    this.logger.info(`Job completed: ${totalProcessed} products in ${duration.toFixed(1)}s`);

    // Include cumulative LLM time (ms) and counts from the pipeline
    const iaDurationMs = this.pipeline.getIaTimeMs();
    const iaCacheHits = this.pipeline.getIaCacheHits();
    const iaLLMCalls = this.pipeline.getIaLLMCalls();

    return {
      status: "success",
      crawler: job.crawler,
      categories: categoriesToProcess,
      results,
      totalCount: totalProcessed,
      duration,
      iaDurationMs,
      iaCacheHits,
      iaLLMCalls,
    };
  }
}
