import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("Checking latest raw_feed item synced status...");

  const { data: item } = await supabase
    .from("raw_feed")
    .select("*")
    .eq("source", "pc-express")
    .order("ingested_at", { ascending: false })
    .limit(1)
    .single();

  if (!item) {
    console.error("No raw_feed item found!");
    process.exit(1);
  }

  console.log(`Latest Item: ${item.id}`);
  console.log(`Synced At: ${item.synced_at}`);

  if (item.synced_at) {
    console.log("✅ Verification SUCCESS: Item is synced!");

    // Also check listing
    const { data: listing } = await supabase
      .from("listings")
      .select("id, product_id")
      .eq("external_id", item.external_id)
      .single();

    if (listing) {
      console.log(`✅ Listing Sync SUCCESS: Listing ID ${listing.id}`);
    } else {
      console.log("❌ Listing Sync FAILED: Listing not found in DB.");
    }
  } else {
    console.log("❌ Verification FAILED: Item is NOT synced.");
    process.exit(1);
  }
}

main();
