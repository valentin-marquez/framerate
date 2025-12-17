import { client } from "@framerate/db";
import type { Bindings } from "@/bindings";

export const createSupabase = (env: Bindings) =>
	client({ url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY });
