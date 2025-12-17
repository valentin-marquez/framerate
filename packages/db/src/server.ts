import {
	type CookieMethodsServer,
	createServerClient,
	parseCookieHeader,
	serializeCookieHeader,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export interface ServerConfig {
	url: string;
	anonKey: string;
	request: Request;
}

export function server(config: ServerConfig): {
	supabase: SupabaseClient<Database>;
	headers: Headers;
} {
	if (!config.url || !config.anonKey) {
		throw new Error("Supabase URL and anon key are required");
	}

	const headers = new Headers();

	const cookies: CookieMethodsServer = {
		getAll() {
			return parseCookieHeader(
				config.request.headers.get("Cookie") ?? "",
			).filter(
				(cookie): cookie is { name: string; value: string } =>
					cookie.value !== undefined,
			);
		},
		setAll(cookiesToSet) {
			for (const { name, value, options } of cookiesToSet) {
				headers.append(
					"Set-Cookie",
					serializeCookieHeader(name, value, options),
				);
			}
		},
	};

	const supabase = createServerClient<Database>(config.url, config.anonKey, {
		cookies,
	});

	return { supabase, headers };
}
