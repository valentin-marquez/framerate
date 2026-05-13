import { client } from "../client";

async function checkProduct() {
  const supabase = client({
    url: process.env.SUPABASE_URL!,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });

  console.log("Checking for test-product-001...");
  console.log("Checking for 00000000-0000-0000-0000-000000000001...");
  const { data, error } = await supabase
    .from("products_canonical")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000001");

  if (error) {
    console.error("Error querying DB:", error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log("✅ Product found in DB:", data[0]);

    if (data[0].is_deleted) {
      console.warn("⚠️ Product is marked as deleted (unexpected for creation test).");
    }
  } else {
    console.error("❌ Product NOT found in DB.");
    process.exit(1);
  }
}

checkProduct();
