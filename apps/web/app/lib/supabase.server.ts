import {
  type CookieMethodsServer,
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";

export function createSupabaseServerClient(request: Request) {
  const headers = new Headers();

  const cookies: CookieMethodsServer = {
    getAll() {
      return parseCookieHeader(request.headers.get("Cookie") ?? "").filter(
        (cookie): cookie is { name: string; value: string } => cookie.value !== undefined,
      );
    },
    setAll(cookiesToSet) {
      for (const { name, value, options } of cookiesToSet) {
        headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
      }
    },
  };

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be provided.");
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, { cookies });

  return { supabase, headers };
}
