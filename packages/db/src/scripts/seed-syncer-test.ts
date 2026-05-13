import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load env from locally, assuming running from packages/db
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Seeding data for Syncer verification...");

  // 0. Ensure Brand and Category exist
  const { data: brand } = await supabase.from("brands").select("id").limit(1).single();
  if (!brand) {
    console.log("Seeding dummy brand...");
    await supabase.from("brands").insert({ name: "TestBrand", slug: "testbrand" });
  }

  const { data: category } = await supabase.from("categories").select("id").limit(1).single();
  if (!category) {
    console.log("Seeding dummy category...");
    await supabase.from("categories").insert({ name: "TestCategory", slug: "testcategory" });
  }

  // 1. Get a Store (pc-express)
  const { data: store } = await supabase.from("stores").select("id, slug").eq("slug", "pc-express").single();
  if (!store) {
    console.error("Store 'pc-express' not found. Ensure seeds ran.");
    process.exit(1);
  }
  console.log(`Using Store: ${store.slug} (${store.id})`);

  // 2. Get or Create a Canonical Product (Test)
  const testProductId = "00000000-0000-0000-0000-000000000001";
  const productId = testProductId;

  const { data: canonical } = await supabase.from("products_canonical").select("id").eq("id", testProductId).single();

  if (!canonical) {
    console.log("Inserting dummy canonical product...");
    const { error: insertError } = await supabase.from("products_canonical").insert({
      id: testProductId,
      specifications: { model: "Test Canonical Model" },
      git_commit_hash: "0000000000000000000000000000000000000000",
      last_synced_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error("Failed to insert dummy canonical:", insertError);
      process.exit(1);
    }
  }
  console.log(`Using Canonical Product: ${productId}`);

  // 3. Insert RAW_FEED item with MATCHED status
  const testUrl = `https://pc-express.cl/test-product-${Date.now()}`;
  const { data: feedItem, error } = await supabase
    .from("raw_feed")
    .insert({
      source: "pc-express", // Matches store slug in our logic
      external_id: testUrl,
      payload: {
        url: testUrl,
        title: "Test Product for Syncer",
        price: 50000,
        stock: true,
        stockQuantity: 10,
        manufacturer: "TestBrand",
        model: "Test Model",
      },
      processing_status: "MATCHED",
      match_candidate_id: productId,
      match_score: 1.0,
      ingested_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert raw_feed:", error);
    process.exit(1);
  }

  console.log(`Inserted raw_feed item: ${feedItem.id}`);
  console.log("Ready to run syncer!");
}

main();
