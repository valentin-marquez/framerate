import { hasRole, type Me, type Role } from "@framerate/contracts";
import { redirect } from "react-router";
import { API_BASE_URL, ApiError, api, apiFetch } from "~/shared/lib/api";

export type UserRole = Role;

const cache = new WeakMap<Request, Promise<Me | null>>();

/** Usuario de la petición (o null). Una sola consulta a la API por petición aunque varios loaders la pidan. */
function loadUser(request: Request): Promise<Me | null> {
  let pending = cache.get(request);
  if (!pending) {
    pending = api.get<Me>("/v1/me", { headers: { cookie: request.headers.get("cookie") ?? "" } }).catch((error) => {
      if (!(error instanceof ApiError && error.status === 401)) console.error("No se pudo consultar la sesión", error);
      return null;
    });
    cache.set(request, pending);
  }
  return pending;
}

export async function getAuthUser(request: Request) {
  return { user: await loadUser(request), headers: new Headers() };
}

export async function requireAuth(request: Request) {
  const user = await loadUser(request);
  if (!user) throw redirect("/");
  return { user, headers: new Headers() };
}

/** Exige un rol global >= `role`. Sin sesión o sin permisos, vuelve al inicio. */
export async function requireRole(request: Request, role: Exclude<UserRole, "user">) {
  const user = await loadUser(request);
  if (!user || !hasRole(user.role, role)) throw redirect("/");
  return { user, role: user.role, headers: new Headers() };
}

/**
 * Llama a la API reenviando la cookie y el Origin del navegador (Better Auth y las escrituras con cookie exigen un
 * Origin de confianza) y devuelve sus `set-cookie`, para que la respuesta de la web se los pase al navegador.
 */
export async function callApi(request: Request, method: string, path: string, body?: unknown) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: new URL(request.url).origin,
      cookie: request.headers.get("cookie") ?? "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookies = new Headers();
  for (const cookie of response.headers.getSetCookie()) cookies.append("set-cookie", cookie);
  return { response, cookies };
}
