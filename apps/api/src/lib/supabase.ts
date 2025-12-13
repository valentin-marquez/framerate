import type { Database } from "@framerate/db";
import { createClient } from "@supabase/supabase-js";
import type { Bindings } from "../bindings";

export const createSupabaseClient = (env: Bindings) => {
	const url =
		env.SUPABASE_URL ||
		(typeof process !== "undefined" ? process.env.SUPABASE_URL : "");
	const key =
		env.SUPABASE_PUBLISHABLE_KEY ||
		(typeof process !== "undefined"
			? process.env.SUPABASE_PUBLISHABLE_KEY
			: "");

	if (!url || !key) {
		throw new Error("Supabase URL and Key must be provided");
	}

	return createClient<Database>(url, key);
};
