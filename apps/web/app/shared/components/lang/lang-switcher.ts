import { data } from "react-router";
import type { Lang } from "~/shared/lib/translations";
import { setLangCookie } from "~/shared/services/lang.server";
import type { Route } from "./+types/lang-switcher";

const SUPPORTED: Lang[] = ["es", "en", "arn"];

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const value = formData.get("lang");

  if (typeof value !== "string" || !(SUPPORTED as string[]).includes(value)) {
    return data({ error: "Invalid lang" }, { status: 400 });
  }

  return data({ result: "success" }, { headers: { "Set-Cookie": setLangCookie(value as Lang) } });
}
