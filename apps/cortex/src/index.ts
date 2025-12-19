import logger from "@/logger";
import { startPoller } from "@/poller";

async function main() {
  logger.info("Cortex starting");
  await startPoller();
}

main().catch((err) => {
  logger.error("Cortex crashed:", err);
  process.exit(1);
});
