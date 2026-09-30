import { data, redirect } from "react-router";
import { callApi } from "~/features/auth/services/auth.server";
import { mergeApi } from "~/features/auth/services/merge.server";
import { safeRedirectPath } from "~/shared/lib/safe-redirect";
import type { Route } from "./+types/auth-action";

const callAuth = (request: Request, path: string, body: unknown) => callApi(request, "POST", `/v1/auth/${path}`, body);

// Con 4xx React Router no revalida la página: un error no cambió nada. `error` es una clave de traducción.
const fail = (error: string) => data({ error }, { status: 400 });

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
    if (typeof provider !== "string" || !provider) return fail("account_link_error");

    const settings = `${site}/ajustes/cuenta`;
    const id = encodeURIComponent(provider);
    const { response, cookies } = await callAuth(request, "link-social", {
      provider,
      callbackURL: `${settings}?conectada=${id}`,
      errorCallbackURL: `${settings}?conectar=${id}`,
    });
    const url = await providerUrl(response);
    if (url) return redirect(url, { headers: cookies });
    return fail("account_link_error");
  }

  if (action === "unlink") {
    const accountId = formData.get("accountId");
    if (typeof accountId !== "string" || !accountId) return fail("account_unlink_error");

    const { response } = await callAuth(request, "unlink-account", { accountId });
    if (response.ok) return { ok: true };
    // Better Auth exige una sesión de menos de un día (`freshAge`) para soltar una cuenta.
    const { code } = (await response.json().catch(() => ({}))) as { code?: string };
    return fail(code === "SESSION_NOT_FRESH" ? "account_unlink_not_fresh" : "account_unlink_error");
  }

  // Unir con otro usuario: la API recuerda a quién te unes (cookie) y entras con la otra cuenta; al volver, con esa
  // sesión, /ajustes/cuenta/unir muestra el resumen.
  if (action === "merge") {
    if (typeof provider !== "string" || !provider) return fail("merge_start_error");

    const start = await mergeApi.start(request);
    if (start.error) return fail("merge_start_error");
    const { response, cookies } = await callAuth(request, "sign-in/social", {
      provider,
      callbackURL: `${site}/ajustes/cuenta/unir`,
      errorCallbackURL: `${site}/ajustes/cuenta?conectar=${encodeURIComponent(provider)}`,
    });
    const url = await providerUrl(response);
    if (!url) return fail("merge_start_error");
    for (const cookie of start.cookies.getSetCookie()) cookies.append("set-cookie", cookie);
    return redirect(url, { headers: cookies });
  }

  return { error: "Invalid action" };
}
