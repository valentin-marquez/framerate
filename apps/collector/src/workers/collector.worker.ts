import { createStrategy } from "@/collector/factory/crawler.factory";
import { MaintenanceService } from "@/collector/services/maintenance.service";
import { StoreService } from "@/collector/services/store.service";
import { Logger } from "@/lib/logger";
import type { CollectorJobData } from "@/queues";

declare var self: Worker;

const logger = new Logger("Worker");
const maintenanceService = new MaintenanceService();
const storeService = new StoreService();

self.onmessage = async (event: MessageEvent) => {
  const job = event.data as CollectorJobData;
  logger.info(`Starting job for ${job.crawler}`);

  try {
    // Check the store activation state in the DB before instantiating/starting the crawler
    const isActive = await storeService.isActive(job.crawler);

    if (isActive === false) {
      logger.info(`Crawler for ${job.crawler} skipped because store is inactive`);
      postMessage({ status: "skipped", crawler: job.crawler, reason: "store inactive" });
      return;
    }

    if (isActive === null) {
      // Store is not present in the `stores` table: warn and proceed to avoid accidentally skipping
      logger.info(`No store config found for '${job.crawler}', proceeding with crawler`);
    }

    const strategy = createStrategy(job.crawler);
    const result = await strategy.execute(job);

    logger.info("Scraping finished, starting variant grouping...");
    await maintenanceService.groupVariants();

    postMessage(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Job failed", errorMessage);
    postMessage({ status: "error", crawler: job.crawler, error: errorMessage });
  }
};
