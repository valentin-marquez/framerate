import type { User } from "@supabase/supabase-js";

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  STRICT_RATE_LIMITER: RateLimit;
  MODERATE_RATE_LIMITER: RateLimit;
  LENIENT_RATE_LIMITER: RateLimit;
  SEARCH_RATE_LIMITER: RateLimit;
};

export type Variables = {
  user: User;
  token: string;
};
