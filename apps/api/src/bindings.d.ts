import type { KVNamespace } from "@cloudflare/workers-types";
import type { User } from "@supabase/supabase-js";

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  RATE_LIMIT_WINDOW_MS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
};

export type Variables = {
  user: User;
};
