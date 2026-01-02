import { createStrategy } from "@/collector/factory/crawler.factory";
import { MaintenanceService } from "@/collector/services/maintenance.service";
import { Logger } from "@/lib/logger";
import type { CollectorJobData } from "@/queues";

declare var self: Worker;

const logger = new Logger("Worker");
const maintenanceService = new MaintenanceService();

self.onmessage = async (event: MessageEvent) => {
  const job = event.data as CollectorJobData;
  logger.info(`Starting job for ${job.crawler}`);

  try {
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
