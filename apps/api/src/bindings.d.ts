import type { KVNamespace } from "@cloudflare/workers-types";
import type { User } from "@supabase/supabase-js";

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
};

export type Variables = {
  user: User;
};
