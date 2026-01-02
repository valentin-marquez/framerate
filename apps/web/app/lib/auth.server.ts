import { redirect } from "react-router";
import { createSupabaseServerClient } from "./supabase.server";

export async function requireAuth(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw redirect("/", { headers });
  }

  return { user, supabase, headers };
}

export async function getAuthUser(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabase, headers };
}

export async function getSession(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { session, supabase, headers };
}
