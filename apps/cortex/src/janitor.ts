import { supabase } from "@/db";
import logger from "@/logger";

const JANITOR_INTERVAL_MS = 1000 * 60 * 60 * 12; // 12 hours

export async function startJanitor() {
  logger.info("Janitor worker started. Schedule: every 12 hours.");

  // Run immediately on start
  await runMaintenance();

  // Schedule periodic runs
  setInterval(() => {
    runMaintenance().catch((err) => logger.error("Janitor execution failed:", err));
  }, JANITOR_INTERVAL_MS);
}

async function runMaintenance() {
  logger.info("Janitor: Starting cleaning cycle...");

  try {
    // 1. Deactivate stale listings (> 3 days old)
    // We assume if they haven't been updated, the crawler might be failing or product is gone
    // But maybe we should just mark them for re-crawl?
    // For now, let's just log and maybe flag.
    const staleThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // In a real scenario, we might want to trigger a re-crawl job here.
    // For now, let's just count them.
    const { count, error } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .lt("last_scraped_at", staleThreshold)
      .eq("is_active", true);

    if (error) {
      logger.error("Janitor: Error checking stale listings:", error);
    } else {
      logger.info(`Janitor: Found ${count} stale listings (>3 days old).`);
    }

    // Let's skip deletion for now to avoid data loss during dev.

    logger.info("Janitor: Maintenance cycle completed.");
  } catch (err) {
    logger.error("Janitor cycle failed:", err);
  }
}
