import { createStrategy } from "@/collector/factory/crawler.factory";
import { Logger } from "@/lib/logger";
import type { CollectorJobData } from "@/queues";

declare var self: Worker;

const logger = new Logger("Worker");

self.onmessage = async (event: MessageEvent) => {
  const job = event.data as CollectorJobData;
  logger.info(`Starting job for ${job.crawler}`);

  try {
    const strategy = createStrategy(job.crawler);
    const result = await strategy.execute(job);
    postMessage(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Job failed", errorMessage);
    postMessage({ status: "error", crawler: job.crawler, error: errorMessage });
  }
};
