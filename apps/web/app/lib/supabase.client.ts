import { client } from "@framerate/db";

export const supabase = client({
	url: import.meta.env.VITE_SUPABASE_URL,
	key: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
