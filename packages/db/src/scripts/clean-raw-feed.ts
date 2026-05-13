import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("Cleaning raw_feed table...");
  const { error } = await supabase.from("raw_feed").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
  if (error) {
    console.error("Failed to delete:", error);
  } else {
    console.log("Deleted all raw_feed items.");
  }
}

main();
