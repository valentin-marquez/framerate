import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export interface ClientConfig {
	url: string;
	key: string;
	options?: {
		auth?: {
			persistSession?: boolean;
		};
	};
}

/**
 * Universal Supabase client factory.
 */
export function client(config: ClientConfig): SupabaseClient<Database> {
	if (!config.url || !config.key) {
		throw new Error("Supabase URL and key are required");
	}

	return createClient<Database>(config.url, config.key, config.options);
}

export type { SupabaseClient };
