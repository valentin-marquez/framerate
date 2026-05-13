import * as cookie from "cookie";
import { cookiePrefix } from "~/shared/lib/config";
import type { Lang } from "~/shared/lib/translations";

const LANG_COOKIE_KEY = `${cookiePrefix}.lang`;
const SUPPORTED: Lang[] = ["es", "en", "arn"];
const DEFAULT_LANG: Lang = "es";

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (SUPPORTED as string[]).includes(value);
}

/** Returns the cookie-stored lang or null if absent/invalid. */
export function getCookieLang(request: Request): Lang | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const parsed = cookie.parse(header)[LANG_COOKIE_KEY];
  return isLang(parsed) ? parsed : null;
}

/** Returns the best-guess lang from Accept-Language, or null if none match. */
export function getAcceptLang(request: Request): Lang | null {
  const accept = request.headers.get("accept-language");
  if (!accept) return null;
  for (const part of accept.split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase().slice(0, 2);
    if (code && isLang(code)) return code;
  }
  return null;
}

/**
 * Resolve lang in priority order: cookie > profile > Accept-Language > default.
 * Cookie wins because it represents an explicit user choice on this device.
 */
export function resolveLang(request: Request, profileLang: Lang | null): Lang {
  return getCookieLang(request) ?? profileLang ?? getAcceptLang(request) ?? DEFAULT_LANG;
}

export function setLangCookie(lang: Lang) {
  return cookie.serialize(LANG_COOKIE_KEY, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
