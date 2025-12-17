import { client } from "@framerate/db";

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

export const supabase = client({
	url: supabaseUrl,
	key: supabaseKey,
	options: { auth: { persistSession: false } },
});
