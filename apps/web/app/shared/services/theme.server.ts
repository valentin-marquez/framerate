import * as cookie from "cookie";
import type { Theme } from "~/shared/lib/client";
import { cookiePrefix } from "~/shared/lib/config";

const THEME_COOKIE_KEY = `${cookiePrefix}.theme`;

export function getTheme(request: Request): Theme | null {
  const cookieHeader = request.headers.get("Cookie");
  const parsed = cookieHeader ? cookie.parse(cookieHeader)[THEME_COOKIE_KEY] : "light";

  if (parsed === "light" || parsed === "dark") {
    return parsed;
  }

  return null;
}

export function setTheme(theme: Theme | "system") {
  if (theme === "system") {
    return cookie.serialize(THEME_COOKIE_KEY, "", {
      path: "/",
      maxAge: -1,
      sameSite: "lax",
    });
  }

  return cookie.serialize(THEME_COOKIE_KEY, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
