import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Need service role to bypass RLS potentially, though RPC is public
);

async function check() {
  console.log("Checking if RPC get_next_review_item exists...");
  const { data, error } = await supabase.rpc("get_next_review_item");

  if (error) {
    console.error("RPC call failed:", error);
    // If error is "function not found", migration failed.
    // If error is something else (like "relation 'pgmq.q_meta' does not exist"), migration applied but broken.
  } else {
    console.log("RPC call success (or at least found). Data:", data);
  }
}

check();
