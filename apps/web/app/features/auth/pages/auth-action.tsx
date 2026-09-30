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

async function providerUrl(response: Response) {
  if (!response.ok) return undefined;
  return ((await response.json()) as { url?: string }).url;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const provider = formData.get("provider");
  const site = new URL(request.url).origin;

  if (action === "logout") {
    const { cookies } = await callAuth(request, "sign-out", {});
    return redirect("/", { headers: cookies });
  }

  if (action === "login") {
    if (typeof provider !== "string" || !provider) return { error: "Provider is required" };

    // Better Auth agrega `?error=<código>` a errorCallbackURL; el aviso lo muestra AuthFlash al volver.
    const back = new URL(safeRedirectPath(formData.get("returnTo")), site);
    const { response, cookies } = await callAuth(request, "sign-in/social", {
      provider,
      callbackURL: back.href,
      errorCallbackURL: back.href,
    });
    const url = await providerUrl(response);
    if (url) return redirect(url, { headers: cookies });

    back.searchParams.set("error", "auth_failed");
    return redirect(back.href);
  }

  if (action === "link") {
    if (typeof provider !== "string" || !provider) return { error: "account_link_error" };

    const settings = `${site}/ajustes/cuenta`;
    const id = encodeURIComponent(provider);
    const { response, cookies } = await callAuth(request, "link-social", {
      provider,
      callbackURL: `${settings}?conectada=${id}`,
      errorCallbackURL: `${settings}?conectar=${id}`,
    });
    const url = await providerUrl(response);
    if (url) return redirect(url, { headers: cookies });
    return { error: "account_link_error" };
  }

  if (action === "unlink") {
    const accountId = formData.get("accountId");
    if (typeof accountId !== "string" || !accountId) return { error: "account_unlink_error" };

    const { response } = await callAuth(request, "unlink-account", { accountId });
    if (response.ok) return { ok: true };
    // Better Auth exige una sesión de menos de un día (`freshAge`) para soltar una cuenta.
    const { code } = (await response.json().catch(() => ({}))) as { code?: string };
    return { error: code === "SESSION_NOT_FRESH" ? "account_unlink_not_fresh" : "account_unlink_error" };
  }

  return { error: "Invalid action" };
}
