import { callApi } from "./auth.server";

// Unir dos usuarios (`/v1/me/merge`): A la inicia con su sesión (cookie `framerate.merge`), entra con la otra cuenta
// (B) y, ya con la sesión de B, ve el resumen y confirma. Al confirmar, B pasa a A y sus sesiones se revocan.

export interface MergeUser {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  providers: string[];
}

export interface MergePreview {
  survivor: MergeUser;
  absorbed: MergeUser;
  counts: Record<"reviews" | "comments" | "organizations" | "claims" | "quotes" | "tickets", number>;
}

async function errorCode(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
  return body.error?.code ?? "merge_failed";
}

async function write(request: Request, method: string, path: string) {
  const { response, cookies } = await callApi(request, method, path);
  return { error: response.ok ? null : await errorCode(response), cookies };
}

export const mergeApi = {
  start: (request: Request) => write(request, "POST", "/v1/me/merge/start"),
  confirm: (request: Request) => write(request, "POST", "/v1/me/merge/confirm"),
  cancel: (request: Request) => write(request, "DELETE", "/v1/me/merge"),

  async preview(request: Request): Promise<{ preview: MergePreview | null; error: string }> {
    const { response } = await callApi(request, "GET", "/v1/me/merge");
    if (response.ok) return { preview: (await response.json()) as MergePreview, error: "" };
    return { preview: null, error: await errorCode(response) };
  },
};
