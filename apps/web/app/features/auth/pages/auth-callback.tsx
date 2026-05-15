import { redirect } from "react-router";
import { profilesService } from "~/features/profile/services/profiles";
import { createSupabaseServerClient } from "~/shared/services/supabase.server";
import type { Route } from "./+types/auth-callback";

export async function loader({ request }: Route.LoaderArgs) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (!code) {
    return redirect("/");
  }

  const { supabase, headers } = createSupabaseServerClient(request);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth error:", error);

    return redirect("/?error=auth_failed");
  }

  // Sincroniza el avatar del provider OAuth al bucket `user-avatars` en best-effort.
  // El endpoint es idempotente, así que es seguro llamarlo en cada login. No bloqueamos
  // el redirect si falla — el usuario verá el avatar la próxima vez que entre.
  const accessToken = data.session?.access_token;
  if (accessToken) {
    try {
      await profilesService.syncAvatar(accessToken);
    } catch (syncError) {
      console.warn("sync-avatar failed:", syncError);
    }
  }

  return redirect(next, { headers });
}
