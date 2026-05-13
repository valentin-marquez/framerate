import { startJanitor } from "@/janitor";
import { openDB } from "@/lib/opendb";
import logger from "@/logger";
import { startPoller } from "./poller";
import { startMatcherWorker } from "./workers/matcher";
import { startSyncerWorker } from "./workers/syncer";

async function main() {
  logger.info("Cortex starting");

  // Initialize OpenDB in background (don't block startup)
  openDB.init().catch((err) => logger.error("OpenDB init failed:", err));

  // Start Janitor (background maintenance)
  startJanitor().catch((err) => logger.error("Janitor failed to start:", err));

  // Start Workers
  startPoller().catch((err) => logger.error("Poller failed to start:", err)); // Changed to non-await and added catch
  startMatcherWorker().catch((err) => logger.error("Matcher Worker failed to start:", err));
  startSyncerWorker().catch((err) => logger.error("Syncer Worker failed to start:", err)); // Added Syncer Worker

  // The main poller loop should be awaited to keep the process alive
  // and handle graceful shutdown.
  await startPoller(); // This seems to be a duplicate call to startPoller, but the instruction explicitly includes it.
}

main().catch((err) => {
  logger.error("Cortex crashed:", err);
  process.exit(1);
});
