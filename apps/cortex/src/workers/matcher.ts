import { supabase } from "@/db";
import { matcherService } from "@/lib/matcher"; // Ensure this matches path
import logger from "@/logger";

const POLL_INTERVAL = 5000; // 5 seconds
const BATCH_SIZE = 10;

export async function startMatcherWorker() {
  logger.info("Matcher Worker started.");

  // Ensure matcher is initialized
  await matcherService.init().catch((err) => {
    logger.error("Matcher init failed:", err);
    // Retry logic or exit? For now, just log and loop will fail until it succeeds.
  });

  loop();
}

async function loop() {
  try {
    await processBatch();
  } catch (err) {
    logger.error("Matcher Worker error:", err);
  } finally {
    setTimeout(loop, POLL_INTERVAL);
  }
}

async function processBatch() {
  // 1. Fetch NEW items from raw_feed
  const { data: items, error } = await supabase
    .from("raw_feed")
    .select("*")
    .eq("processing_status", "NEW")
    .limit(BATCH_SIZE);

  if (error) throw error;

  if (!items || items.length === 0) return;

  logger.info(`Matcher Worker: Processing ${items.length} items...`);

  for (const item of items) {
    try {
      await processItem(item);
    } catch (err) {
      logger.error(`Failed to process raw_feed ${item.id}:`, err);
      // Mark as FAILED or retry?
      await supabase
        .from("raw_feed")
        .update({
          processing_status: "FAILED",
          error_message: String(err),
        })
        .eq("id", item.id);
    }
  }
}

// biome-ignore lint/suspicious/noExplicitAny: specs sin tipo
async function processItem(item: any) {
  // Construct search query from payload
  const payload = item.payload || {};
  // Use title, or specific fields if available
  const query = payload.title || `${payload.manufacturer || ""} ${payload.model || ""}`;

  if (!query || query.trim().length === 0) {
    throw new Error("Empty query derived from payload");
  }

  // Perform Search
  const results = await matcherService.search(query);
  const topMatch = results[0];

  let status = "NEW"; // Should be updated to MATCHED or AMBIGUOUS
  let candidateId = null;
  let score = 0;
  let decision = "NONE";

  if (topMatch) {
    score = topMatch.score;
    decision = topMatch.confidence; // MATCH, AMBIGUOUS, NONE

    if (decision === "MATCH") {
      status = "MATCHED";
      candidateId = topMatch.candidate.id;
    } else if (decision === "AMBIGUOUS") {
      status = "MATCHED"; // Technically matched to a candidate, but flagged for review?
      // Actually, we should call it AMBIGUOUS status?
      // Our DB enum has: NEW, PROCESSING, MATCHED, FAILED.
      // Wait, schema says: 'NEW', 'PROCESSING', 'MATCHED', 'FAILED'.
      // It doesn't have 'AMBIGUOUS'.
      // So we mark as MATCHED but push to Review Queue?
      // OR we add AMBIGUOUS to enum?
      // For now, let's treat AMBIGUOUS as MATCHED but with low confidence?
      // "The Gatekeeper" plan says "Poll pgmq".
      status = "MATCHED";
      candidateId = topMatch.candidate.id;

      // Push to Queue
      await enqueueForReview(item.id);
    } else {
      // NONE (New product potentially)
      status = "MATCHED"; // ??? No, if no candidate, status?
      // Maybe 'FAILED'? Or 'NEW'?
      // If no match, it might be a new product.
      // We should queue it for "Create New Product" review.
      await enqueueForReview(item.id);
      // Status remains NEW or custom?
      // Let's leave it as NEW or set to FAILED (requiring attention)?
      // Or "PROCESSING" implies sticking in queue?
      // Let's use PROCESSING for "In Review Queue".
      // But verify enum support: NEW, PROCESSING, MATCHED, FAILED.
      status = "PROCESSING";
    }
  } else {
    // No results at all
    status = "PROCESSING";
    await enqueueForReview(item.id);
  }

  // Update raw_feed
  await supabase
    .from("raw_feed")
    .update({
      processing_status: status as "NEW" | "PROCESSING" | "MATCHED" | "FAILED",
      match_candidate_id: candidateId,
      match_score: score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  logger.info(`Processed ${item.id}: ${decision} (Score: ${score?.toFixed(2)})`);
}

async function enqueueForReview(rawFeedId: string) {
  logger.info(`Enqueuing ${rawFeedId} for review...`);
  // Cast rpc name to any because types might lag behind
  // biome-ignore lint/suspicious/noExplicitAny: specs sin tipo
  const { error } = await supabase.rpc("enqueue_review_item" as any, {
    p_raw_feed_id: rawFeedId,
  });
  if (error) {
    // If RPC fails (e.g. wrapper missing), fallback or log
    logger.error("Failed to enqueue:", error);
    throw error;
  }
}
