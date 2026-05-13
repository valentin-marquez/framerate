import { client } from "../client";

async function verifyMatcher() {
  const supabase = client({
    url: process.env.SUPABASE_URL!,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });

  console.log("Inserting test raw_feed item...");

  // 1. Insert Raw Feed Item
  const payload = {
    title: "TestCorp FutureGPU 9000 12GB OC Edition",
    price: 500000,
    image: "http://example.com/gpu.jpg",
  };

  const { data: insertData, error: insertError } = await supabase
    .from("raw_feed")
    .insert({
      source: "TestRetalier",
      external_id: "test-sku-123",
      payload: payload,
      processing_status: "NEW",
    })
    .select()
    .single();

  if (insertError) {
    console.error("❌ Failed to insert raw_feed:", insertError);
    process.exit(1);
  }

  console.log("✅ Inserted raw_feed item:", insertData.id);
  console.log("Waiting for Matcher/Cortex to process...");

  // 2. Poll for status change
  let attempts = 0;
  while (attempts < 10) {
    await new Promise((r) => setTimeout(r, 2000)); // Wait 2s

    const { data: checkData, error: checkError } = await supabase
      .from("raw_feed")
      .select("*")
      .eq("id", insertData.id)
      .single();

    if (checkError) {
      console.error("Error polling:", checkError);
      break;
    }

    console.log(`Attempt ${attempts + 1}: Status = ${checkData.processing_status}`);

    if (
      checkData.processing_status === "MATCHED" ||
      checkData.processing_status === "AMBIGUOUS" ||
      checkData.match_candidate_id
    ) {
      console.log("✅ Matcher processed item!");
      console.log("Candidate ID:", checkData.match_candidate_id);
      console.log("Match Score:", checkData.match_score);

      if (checkData.match_candidate_id === "00000000-0000-0000-0000-000000000001") {
        console.log("✅ CORRECTLY MATCHED to Test Product!");
      } else {
        console.warn("⚠️ Matched to unexpected ID (or null if ambiguous).");
      }
      return;
    }

    attempts++;
  }

  console.error("❌ Timed out waiting for Matcher.");
  process.exit(1);
}

verifyMatcher();
