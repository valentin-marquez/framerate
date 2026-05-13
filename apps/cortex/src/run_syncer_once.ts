import logger from "./logger";
import { processBatch } from "./workers/syncer";

async function main() {
  logger.info("Running Syncer Batch ONCE...");
  try {
    await processBatch();
    logger.info("Syncer Batch Completed.");
  } catch (err) {
    logger.error("Syncer Batch Failed:", err);
  }
}

main();
