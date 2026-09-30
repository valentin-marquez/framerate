import { AsyncLocalStorage } from "node:async_hooks";
import { createRequestHandler, RouterContextProvider } from "react-router";
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
const requestContext = new AsyncLocalStorage<{ cookie: string | null; ip: string | null; fetch?: typeof fetch }>();
setServerContext(() => requestContext.getStore());

const requestHandler = createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    const api = import.meta.env.DEV ? undefined : env.API;
    return requestContext.run(
      {
        cookie: request.headers.get("cookie"),
        ip: request.headers.get("cf-connecting-ip"),
        fetch: api?.fetch.bind(api),
      },
      () =>
        requestHandler(
          request,
          Object.assign(context, {
            cloudflare: { env, ctx },
          }),
        ),
    );
  },
} satisfies ExportedHandler<Env>;
