import type { PipelineContext, ProductPipeline } from "@/collector/pipelines/product.pipeline";
import type { CategorySlug } from "@/collector/services/catalog.service";
import type { MyShopCrawler } from "@/crawlers/myshop";
import { Logger } from "@/lib/logger";
import type { CollectorJobData } from "@/queues";
import type { JobResult, JobStrategy } from "./base.strategy";

export class ApiStrategy implements JobStrategy {
  private logger = new Logger("ApiStrategy");

  constructor(
    private crawler: InstanceType<typeof MyShopCrawler>,
    private pipeline: ProductPipeline,
  ) {}

  async execute(job: CollectorJobData): Promise<JobResult> {
    const startTime = Date.now();

    const categoriesToProcess: string[] =
      job.category === "all" || !job.category ? Object.keys(this.crawler.CATEGORIES ?? {}) : [job.category];

    const results: Record<string, number> = {};
    let totalProcessed = 0;

    const crawlerSlug = this.crawler.slug ?? "";
    const storeId = await this.pipeline.getCatalogService().getStoreId(crawlerSlug);
    if (!storeId) throw new Error(`Store '${crawlerSlug}' not found`);

    for (const category of categoriesToProcess) {
      this.logger.info(`[MyShop] Processing ${category}`);
      const products = await this.crawler.crawlCategory(category as CategorySlug);
      this.logger.info(`[MyShop] Found ${products.length} products for ${category}`);

      let processed = 0;
      for (const raw of products) {
        const ctx: PipelineContext = {
          category: category as CategorySlug,
          storeId,
          crawlerType: job.crawler,
        };
        const res = await this.pipeline.process(raw, ctx);
        if (res.success) processed++;
        else if (res.error) this.logger.warn(`[API][${category}] ${res.error}: ${raw.url?.slice(-50)}`);
      }

      results[category] = processed;
      totalProcessed += processed;
    }

    const duration = (Date.now() - startTime) / 1000;
    this.logger.info(`[MyShop] Job completed: ${totalProcessed} products in ${duration.toFixed(1)}s`);

    const iaCacheHits = this.pipeline.getIaCacheHits();

    return {
      status: "success",
      crawler: job.crawler,
      categories: categoriesToProcess,
      results,
      totalCount: totalProcessed,
      duration,
      iaCacheHits,
    };
  }
}
