import type { Provider } from "@supabase/supabase-js";
import { redirect } from "react-router";
import { createSupabaseServerClient } from "@/lib/supabase.server";
import type { Route } from "./+types/action.auth";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const { supabase, headers } = createSupabaseServerClient(request);

  if (action === "logout") {
    await supabase.auth.signOut();
    return redirect("/", { headers });
  }

  if (action === "login") {
    const provider = formData.get("provider") as Provider;
    const returnTo = formData.get("returnTo") as string | null;

    if (!provider) {
      return { error: "Provider is required" };
    }

    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(returnTo ?? "/")}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data.url) {
      return redirect(data.url, { headers });
    }
  }

  return { error: "Invalid action" };
}
