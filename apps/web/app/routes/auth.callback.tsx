import { redirect } from "react-router";
import { createSupabaseServerClient } from "@/lib/supabase.server";
import type { Route } from "./+types/auth.callback";

export async function loader({ request }: Route.LoaderArgs) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (!code) {
    return redirect("/");
  }

  const { supabase, headers } = createSupabaseServerClient(request);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth error:", error);

    return redirect("/?error=auth_failed");
  }

  return redirect(next, { headers });
}
