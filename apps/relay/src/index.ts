import { timingSafeEqual } from "node:crypto";
import { RELAY_HOSTS } from "./hosts";

/**
 * Relay de salida para ingest (#154): descarga una URL de una tienda permitida desde la IP residencial y devuelve la
 * respuesta tal cual (estado, content-type, cuerpo). No sabe de productos; toda la lógica sigue en los Workers.
 * `GET|POST /fetch?url=…` con `Authorization: Bearer <RELAY_TOKEN>`; `GET /health` sin token.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 25_000;
const MAX_REDIRECTS = 5;
const FORWARD = ["user-agent", "accept", "accept-language", "content-type"];
const BACK = ["content-type", "retry-after"];

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface RelayOptions {
  token: string;
  fetch?: Fetch;
  hosts?: readonly string[];
}

export async function handle(req: Request, opts: RelayOptions): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/health") return new Response("ok");
  if (url.pathname !== "/fetch") return new Response("not found", { status: 404 });
  if (req.method !== "GET" && req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!authorized(req.headers.get("authorization"), opts.token)) return new Response("forbidden", { status: 403 });
  const hosts = opts.hosts ?? RELAY_HOSTS;
  const target = allowed(url.searchParams.get("url"), hosts);
  if (!target) return new Response("host not allowed", { status: 403 });

  const headers = new Headers();
  for (const name of FORWARD) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = req.method === "POST" ? await req.text() : undefined;
  const doFetch = opts.fetch ?? fetch;
  try {
    let current = target;
    for (let hop = 0; ; hop++) {
      const upstream = await doFetch(current, {
        method: req.method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const location = upstream.headers.get("location");
      if (upstream.status >= 300 && upstream.status < 400 && location && hop < MAX_REDIRECTS) {
        const next = allowed(new URL(location, current).href, hosts);
        if (!next) return relayResponse("redirect host not allowed", 403);
        current = next;
        continue;
      }
      const bytes = await upstream.arrayBuffer();
      if (bytes.byteLength > MAX_BYTES) return relayResponse("response too large", 502);
      const back = new Headers({ "x-relay": "1" });
      for (const name of BACK) {
        const value = upstream.headers.get(name);
        if (value) back.set(name, value);
      }
      return new Response(bytes, { status: upstream.status, headers: back });
    }
  } catch (error) {
    return relayResponse(`upstream: ${error instanceof Error ? error.message : String(error)}`, 502);
  }
}

const relayResponse = (text: string, status: number) =>
  new Response(text, { status, headers: { "x-relay": "1", "content-type": "text/plain" } });

function allowed(raw: string | null, hosts: readonly string[]): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return hosts.includes(url.hostname) ? url.href : null;
}

function authorized(header: string | null, token: string): boolean {
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

if (import.meta.main) {
  const token = process.env.RELAY_TOKEN;
  if (!token) throw new Error("Falta RELAY_TOKEN");
  const server = Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: (req) => handle(req, { token }) });
  console.log(`relay en :${server.port}, ${RELAY_HOSTS.length} dominios permitidos`);
}
