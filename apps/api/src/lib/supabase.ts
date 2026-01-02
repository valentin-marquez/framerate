import { client } from "@framerate/db";
import type { Bindings } from "@/bindings";

export const createSupabase = (env: Bindings, accessToken?: string) =>
  client({
    url: env.SUPABASE_URL,
    key: env.SUPABASE_PUBLISHABLE_KEY,
    options: accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : undefined,
  });
