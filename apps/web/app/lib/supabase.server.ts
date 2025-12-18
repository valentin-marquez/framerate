import { server } from "@framerate/db";

export function createSupabaseServerClient(request: Request) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL and Anon Key must be provided.");
  }

  return server({ url, anonKey, request });
}
