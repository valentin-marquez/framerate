import logger from "./logger";
import { startMatcherWorker } from "./workers/matcher";

async function main() {
  logger.info("Running Matcher Worker manually...");
  // We can't easily access the internal loop or processBatch without exporting it.
  // So we'll just start the worker and let it run for a bit, then exit.

  // Actually, startMatcherWorker enters an infinite loop.
  // I should have exported processBatch or similar.
  // But I can modification workers/matcher.ts to export processBatch?
  // Or just run startMatcherWorker and kill process after 10 seconds.

  startMatcherWorker();

  setTimeout(() => {
    logger.info("Manual run finished. Exiting.");
    process.exit(0);
  }, 10000);
}

main();
