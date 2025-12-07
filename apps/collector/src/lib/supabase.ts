import type { Database } from "@framerate/db";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Bun.env.SUPABASE_URL;
const supabaseKey = Bun.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL in environment variables");
  throw new Error("Missing SUPABASE_URL");
}
if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in environment variables");
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
