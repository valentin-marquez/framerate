import { client } from "../client";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://qkvqtkrsmrzegckrakwb.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdnF0a3JzbXJ6ZWdja3Jha3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NDQ1MjMsImV4cCI6MjA3OTUyMDUyM30.JZJdpiZ9mS_A0SSvzYVENLuGc-B6VwjK770j41A0UUs";

const supabase = client({
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
});

async function main() {
  console.log("Checking tables...");

  console.log("Fetching products count...");
  const { count: productsCount, error: productsError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  if (productsError) {
    console.error("Error fetching products count:", productsError.message);
  } else {
    console.log(`Total products: ${productsCount}`);
  }

  console.log("Fetching sample products...");
  const { data: products, error: prodDataError } = await supabase.from("products").select("*").limit(5);

  if (prodDataError) {
    console.error("Error fetching products:", prodDataError.message);
  } else {
    console.log(`Found ${products?.length} products.`);
    products?.forEach((p) => {
      console.log("---------------------------------------------------");
      console.log("Keys:", Object.keys(p));
      console.log(`ID: ${p.id}`);
      console.log(`Name: ${p.name}`);
      // console.log(`Brand: ${p.brand}`); // brand might not exist
      console.log(`MPN: ${p.mpn}`);
      console.log(`Price: ${p.price_current} ${p.currency}`);
      console.log(`Specs: ${p.specs ? `${JSON.stringify(p.specs).substring(0, 100)}...` : "null"}`);
      console.log(`Raw Data: ${JSON.stringify(p).substring(0, 200)}...`);
    });
  }
}

main();
