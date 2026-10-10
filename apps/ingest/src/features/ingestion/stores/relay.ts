import type { Logger } from "@framerate/kit";
import { type Fetch, RENDER_HEADER } from "./http";

/**
 * `fetch` que sale por el relay del servidor propio (#154), para tiendas que cortan las IPs de Cloudflare. El relay
 * devuelve la respuesta de la tienda tal cual, marcada con `x-relay`; si no responde o la marca falta (túnel caído,
 * error del proxy), se cae a `fetch` directo por el resto de la corrida y se registra una vez. Una página pedida con
 * `render` no tiene directo al que caer: sin relay, falla.
 */
export function relayFetch(opts: { url: string; token: string; log: Logger; fetch?: Fetch }): Fetch {
  const direct = opts.fetch ?? fetch;
  const base = opts.url.replace(/\/$/, "");
  let down = false;
  return async (input, init) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const { [RENDER_HEADER]: render, ...headers } = (init?.headers ?? {}) as Record<string, string>;
    if (render) {
      const wait = render === "1" ? "" : `&wait=${encodeURIComponent(render)}`;
      const res = await direct(`${base}/render?url=${encodeURIComponent(target)}${wait}`, {
        signal: init?.signal,
        headers: { ...headers, Authorization: `Bearer ${opts.token}` },
      });
      if (!res.headers.get("x-relay")) throw new Error(`relay caído: no se puede renderizar ${target} (${res.status})`);
      return res;
    }
    if (!down) {
      try {
        const res = await direct(`${base}/fetch?url=${encodeURIComponent(target)}`, {
          method: init?.method,
          body: init?.body,
          signal: init?.signal,
          headers: { ...headers, Authorization: `Bearer ${opts.token}` },
        });
        if (res.headers.get("x-relay")) return res;
        opts.log.warn("egress.relay_down", { status: res.status });
      } catch (error) {
        opts.log.warn("egress.relay_down", { error: error instanceof Error ? error.message : String(error) });
      }
      down = true;
    }
    return direct(input, { ...init, headers });
  };
}
