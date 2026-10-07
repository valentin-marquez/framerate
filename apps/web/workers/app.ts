import { AsyncLocalStorage } from "node:async_hooks";
import { createRequestHandler, RouterContextProvider } from "react-router";
import { markdownResponse, varyByAccept } from "../app/features/agents/markdown.server";
import { setServerContext } from "../app/shared/lib/api";

declare module "react-router" {
  export interface RouterContextProvider {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

// Contexto de la petición en curso: `api` reenvía la cookie a la API y, en producción, usa el service binding.
const requestContext = new AsyncLocalStorage<{
  cookie: string | null;
  ip: string | null;
  fetch?: typeof fetch;
  memo: Map<string, Promise<unknown>>;
  setCookies: string[];
}>();
setServerContext(() => requestContext.getStore());

const requestHandler = createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    const api = import.meta.env.DEV ? undefined : env.API;
    const setCookies: string[] = [];
    const response = await requestContext.run(
      {
        cookie: request.headers.get("cookie"),
        ip: request.headers.get("cf-connecting-ip"),
        fetch: api?.fetch.bind(api),
        memo: new Map(),
        setCookies,
      },
      async () =>
        (await markdownResponse(request)) ??
        varyByAccept(
          request,
          await requestHandler(
            request,
            Object.assign(context, {
              cloudflare: { env, ctx },
            }),
          ),
        ),
    );
    return withApiCookies(response, setCookies);
  },
} satisfies ExportedHandler<Env>;

/**
 * Las acciones ya reenvían sus `set-cookie` (`callApi`): esos ganan. Varias llamadas pueden renovar la misma
 * cookie; va la última.
 */
function withApiCookies(response: Response, setCookies: string[]) {
  const name = (cookie: string) => cookie.slice(0, cookie.indexOf("="));
  const present = new Set(response.headers.getSetCookie().map(name));
  const missing = new Map(setCookies.filter((c) => !present.has(name(c))).map((c) => [name(c), c]));
  if (missing.size === 0) return response;
  const headers = new Headers(response.headers);
  for (const cookie of missing.values()) headers.append("set-cookie", cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
