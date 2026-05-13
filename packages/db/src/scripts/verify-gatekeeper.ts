import { client } from "../client";

async function verifyGatekeeper() {
  const supabase = client({
    url: process.env.SUPABASE_URL!,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });

  console.log("Fetching next review item...");

  // Call the RPC function used by the UI
  const { data, error } = await supabase.rpc("get_next_review_item");

  if (error) {
    console.error("❌ Failed to fetch review item:", error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.warn("⚠️ No items in review queue (might be expected if queue was empty).");
  } else {
    const item = data[0];
    console.log("✅ Got review item:", item.msg_id);
    console.log("   Raw Feed ID:", item.raw_feed_id);
    console.log("   Candidate ID:", item.candidate_id);
    console.log("   Match Score:", item.match_score);

    // Optionally resolve it to clean up?
    // console.log("Resolving item...");
    // await supabase.rpc("resolve_review_item", {
    //    p_msg_id: item.msg_id,
    //    p_decision: "MATCH",
    //    p_raw_feed_id: item.raw_feed_id
    // });
  }
}

verifyGatekeeper();
