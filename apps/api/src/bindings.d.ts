import type { User } from "@supabase/supabase-js";

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

export type Variables = {
  user: User;
};
