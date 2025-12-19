import type { Database } from "@framerate/db";
import { client } from "@framerate/db";
import { config } from "@/config";

// Use the shared typed client from packages/db (fail fast if missing)
export const supabase = client({
  url: config.SUPABASE_URL,
  key: config.SUPABASE_SERVICE_ROLE_KEY,
  options: { auth: { persistSession: false } },
}) as unknown as import("@supabase/supabase-js").SupabaseClient<Database>;
