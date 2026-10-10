import { timingSafeEqual } from "node:crypto";
import { RELAY_HOSTS } from "./hosts";

/**
 * Relay de salida para ingest (#154): descarga una URL de una tienda permitida desde la IP residencial y devuelve la
 * respuesta tal cual (estado, content-type, cuerpo). No sabe de productos; toda la lógica sigue en los Workers.
 * `GET|POST /fetch?url=…` con `Authorization: Bearer <RELAY_TOKEN>`; `GET /health` sin token.
 * `GET /render?url=…`: lo mismo, pero devuelve el HTML ya ejecutado por Chromium headless, para tiendas que arman la
 * página con JavaScript. No sirve para pasar desafíos anti-bot: sale con el mismo user agent del Worker.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 25_000;
const MAX_REDIRECTS = 5;
const FORWARD = ["user-agent", "accept", "accept-language", "content-type"];
const BACK = ["content-type", "retry-after"];

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type Render = (url: string, userAgent: string) => Promise<string>;

export interface RelayOptions {
  token: string;
  fetch?: Fetch;
  render?: Render;
  hosts?: readonly string[];
}

export async function handle(req: Request, opts: RelayOptions): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/health") return new Response("ok");
  if (url.pathname !== "/fetch" && url.pathname !== "/render") return new Response("not found", { status: 404 });
  if (req.method !== "GET" && req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!authorized(req.headers.get("authorization"), opts.token)) return new Response("forbidden", { status: 403 });
  const hosts = opts.hosts ?? RELAY_HOSTS;
  const target = allowed(url.searchParams.get("url"), hosts);
  if (!target) return new Response("host not allowed", { status: 403 });
  if (url.pathname === "/render") {
    if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
    try {
      const html = await serialized(() =>
        (opts.render ?? chromium)(target, req.headers.get("user-agent") ?? "FramerateBot/1.0"),
      );
      if (Buffer.byteLength(html) > MAX_BYTES) return relayResponse("response too large", 502);
      return new Response(html, { headers: { "x-relay": "1", "content-type": "text/html; charset=utf-8" } });
    } catch (error) {
      return relayResponse(`render: ${error instanceof Error ? error.message : String(error)}`, 502);
    }
  }

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
      const bytes = await readCapped(upstream);
      if (!bytes) return relayResponse("response too large", 502);
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

/** Lee el cuerpo cortando apenas pasa el tope, sin cargar entero uno enorme en memoria. */
async function readCapped(res: Response): Promise<Uint8Array | null> {
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
    await res.body?.cancel();
    return null;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body ?? []) {
    size += chunk.byteLength;
    if (size > MAX_BYTES) {
      await res.body?.cancel();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ponytail: un navegador a la vez (cada uno pesa ~300 MB); cola por promesa, sube a un pool si las corridas esperan.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

const RENDER_MS = 30_000;
// La página corre JS ajeno dentro de la red de la casa: un PAC manda toda dirección privada o local a un proxy muerto.
// Las reglas de resolución de Chromium no alcanzan: no se aplican a IPs escritas tal cual.
const PAC = `function FindProxyForURL(url, host) {
  var dead = "PROXY 127.0.0.1:9";
  if (isPlainHostName(host) || dnsDomainIs(host, ".local") || host == "localhost") return dead;
  var ip = /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(host) ? host : dnsResolve(host);
  if (!ip) return dead;
  if (isInNet(ip, "127.0.0.0", "255.0.0.0") || isInNet(ip, "10.0.0.0", "255.0.0.0") ||
      isInNet(ip, "172.16.0.0", "255.240.0.0") || isInNet(ip, "192.168.0.0", "255.255.0.0") ||
      isInNet(ip, "169.254.0.0", "255.255.0.0") || isInNet(ip, "100.64.0.0", "255.192.0.0")) return dead;
  return "DIRECT";
}`;
const PAC_URL = `data:application/x-ns-proxy-autoconfig;base64,${Buffer.from(PAC).toString("base64")}`;

/** Chromium headless sin librerías: `--dump-dom` imprime el DOM cuando la página termina de cargar. */
export const chromium: Render = async (url, userAgent) => {
  const proc = Bun.spawn(
    [
      process.env.CHROMIUM_PATH ?? "chromium-browser",
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--mute-audio",
      "--virtual-time-budget=10000",
      `--user-agent=${userAgent}`,
      `--proxy-pac-url=${PAC_URL}`,
      "--dump-dom",
      url,
    ],
    { stdout: "pipe", stderr: "ignore" },
  );
  const timer = setTimeout(() => proc.kill(), RENDER_MS);
  try {
    const html = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0 || !html.trim()) throw new Error(`chromium salió con ${code}`);
    // Sin red o bloqueada por el PAC, Chromium imprime su página de error en vez de fallar.
    const netError =
      html.match(/id="main-frame-error"[\s\S]*?(ERR_[A-Z_]+)/)?.[1] ??
      (html.includes('id="main-frame-error"') && "ERR");
    if (netError) throw new Error(`chromium: ${netError}`);
    return html;
  } finally {
    clearTimeout(timer);
  }
};

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
  // Sólo el puerto por defecto: con otro, un dominio permitido sirve para tocar otros servicios del mismo host.
  if (url.port !== "" || url.username || url.password) return null;
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
