import { data, redirect } from "react-router";
import { parseThemeData } from "~/shared/lib/client";
import { safeRedirectPath } from "~/shared/lib/safe-redirect";
import { setTheme } from "~/shared/services/theme.server";
import type { Route } from "./+types/theme-switcher";

export async function action({ request }: Route.ActionArgs) {
  const formData = Object.fromEntries(await request.formData());

  let parsed: ReturnType<typeof parseThemeData>;
  try {
    parsed = parseThemeData(formData);
  } catch {
    return data({ error: "Invalid theme data" }, { status: 400 });
  }

  const { theme, redirectTo } = parsed;

  const responseInit = {
    headers: { "Set-Cookie": setTheme(theme) },
  };

  if (redirectTo) {
    return redirect(safeRedirectPath(redirectTo), responseInit);
  }

  return data({ result: "success" }, responseInit);
}
