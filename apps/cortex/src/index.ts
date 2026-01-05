import { openDB } from "@/lib/opendb";
import logger from "@/logger";
import { startPoller } from "@/poller";

async function main() {
  logger.info("Cortex starting");

  // Initialize OpenDB in background (don't block startup)
  openDB.init().catch((err) => logger.error("OpenDB init failed:", err));

  await startPoller();
}

main().catch((err) => {
  logger.error("Cortex crashed:", err);
  process.exit(1);
});
