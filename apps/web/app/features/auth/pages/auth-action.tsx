import { redirect } from "react-router";
import { API_BASE_URL, apiFetch } from "~/shared/lib/api";
import { safeRedirectPath } from "~/shared/lib/safe-redirect";
import type { Route } from "./+types/auth-action";

/** Llama a la API de sesión y devuelve las cookies que estableció, para que el navegador las reciba. */
async function callAuth(request: Request, path: string, body: unknown) {
  const response = await apiFetch(`${API_BASE_URL}/v1/auth/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: new URL(request.url).origin,
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(body),
  });
  const cookies = new Headers();
  for (const cookie of response.headers.getSetCookie()) cookies.append("set-cookie", cookie);
  return { response, cookies };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const site = new URL(request.url).origin;

  if (action === "logout") {
    const { cookies } = await callAuth(request, "sign-out", {});
    return redirect("/", { headers: cookies });
  }

  if (action === "login") {
    const provider = formData.get("provider");
    if (typeof provider !== "string" || !provider) return { error: "Provider is required" };

    const { response, cookies } = await callAuth(request, "sign-in/social", {
      provider,
      callbackURL: `${site}${safeRedirectPath(formData.get("returnTo"))}`,
      errorCallbackURL: `${site}/?error=auth_failed`,
    });
    if (!response.ok) return { error: "No se pudo iniciar sesión" };

    const { url } = (await response.json()) as { url?: string };
    if (url) return redirect(url, { headers: cookies });
  }

  return { error: "Invalid action" };
}
