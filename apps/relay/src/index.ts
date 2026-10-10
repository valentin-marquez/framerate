import { timingSafeEqual } from "node:crypto";
import { RELAY_HOSTS } from "./hosts";

/**
 * Relay de salida para ingest (#154): descarga una URL de una tienda permitida desde la IP residencial y devuelve la
 * respuesta tal cual (estado, content-type, cuerpo). No sabe de productos; toda la lógica sigue en los Workers.
 * `GET|POST /fetch?url=…` con `Authorization: Bearer <RELAY_TOKEN>`; `GET /health` sin token.
 * `GET /render?url=…[&wait=<selector>]`: lo mismo, pero devuelve el HTML ya ejecutado por Chromium (`Bun.WebView`), para
 * tiendas que arman la página con JavaScript. Con `wait`, responde apenas aparece ese selector. No sirve para pasar
 * desafíos anti-bot: sale con el mismo user agent del Worker.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 25_000;
const MAX_REDIRECTS = 5;
const FORWARD = ["user-agent", "accept", "accept-language", "content-type"];
const BACK = ["content-type", "retry-after"];

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type Render = (url: string, userAgent: string, waitFor?: string) => Promise<string>;

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
      const waitFor = url.searchParams.get("wait") ?? undefined;
      const pending = limited(() =>
        (opts.render ?? webview)(target, req.headers.get("user-agent") ?? "FramerateBot/1.0", waitFor),
      );
      if (!pending) return relayResponse("render queue full", 503);
      const html = await pending;
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

// ponytail: dos pestañas a la vez en un solo Chromium; sube MAX_TABS si las corridas esperan y el servidor aguanta.
// Con tope de espera: sin él, cualquiera con el token apila renders hasta tumbar el servidor.
const MAX_TABS = 2;
const MAX_WAITING = 4;
let active = 0;
const waiters: (() => void)[] = [];
function limited<T>(task: () => Promise<T>): Promise<T> | null {
  if (active >= MAX_TABS && waiters.length >= MAX_WAITING) return null;
  const start = active < MAX_TABS ? Promise.resolve() : new Promise<void>((r) => waiters.push(r));
  if (active < MAX_TABS) active++;
  return start.then(task).finally(() => {
    const next = waiters.shift();
    if (next) next();
    else active--;
  });
}

const RENDER_MS = 30_000;
const WAIT_POLL_MS = 150;
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
// Lo que no cambia el DOM que se lee: imágenes, fuentes, video y rastreadores. La página de GPU de TyT baja de 4,2 a 2,4 s.
const BLOCKED = [
  ...["png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "ico", "woff", "woff2", "ttf", "otf", "mp4", "webm"].map(
    (ext) => `*.${ext}*`,
  ),
  ...["google-analytics", "googletagmanager", "doubleclick", "facebook", "hotjar", "clarity.ms", "tiktok"].map(
    (host) => `*${host}*`,
  ),
];

/** Lo que usa el relay de `Bun.WebView` (experimental en Bun 1.4; los tipos de `@types/bun` 1.3 no lo traen). */
interface WebViewTab {
  navigate(url: string): Promise<void>;
  evaluate(script: string): Promise<unknown>;
  cdp(method: string, params: object): Promise<unknown>;
  close(): void;
}
type WebViewCtor = new (options: object) => WebViewTab;

/**
 * Una pestaña por página en un Chromium que Bun mantiene vivo (y relanza si muere). Su sandbox no arranca con el
 * seccomp por defecto de Docker: la frontera es el contenedor (usuario sin root) y la red de la casa queda fuera por
 * el PAC.
 */
export const webview: Render = async (url, userAgent, waitFor) => {
  const WebView = (Bun as unknown as { WebView: WebViewCtor }).WebView;
  const tab = new WebView({
    width: 1280,
    height: 800,
    backend: {
      type: "chrome",
      path: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium-browser",
      argv: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", `--proxy-pac-url=${PAC_URL}`],
    },
  });
  const deadline = Date.now() + RENDER_MS;
  let timer: Timer | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("render: timeout")), RENDER_MS);
  });
  const run = async () => {
    // `cdp` necesita una sesión, y la sesión nace con la primera navegación.
    await tab.navigate("about:blank");
    // El navegador es compartido: las cookies de la página anterior no llegan a esta. La caché se queda (Chrome ya la
    // separa por sitio) porque reusar el JavaScript de la tienda entre páginas es lo que hace rápido el render.
    await tab.cdp("Network.enable", {});
    await tab.cdp("Network.clearBrowserCookies", {});
    await tab.cdp("Emulation.setUserAgentOverride", { userAgent });
    await tab.cdp("Network.setBlockedURLs", { urls: BLOCKED });
    await tab.navigate(url);
    if (waitFor) {
      const probe = `!!document.querySelector(${JSON.stringify(waitFor)})`;
      // Con plazo propio: el timeout de afuera responde, pero este bucle tiene que terminar también.
      while (!(await tab.evaluate(probe))) {
        if (Date.now() > deadline) throw new Error("render: timeout");
        await Bun.sleep(WAIT_POLL_MS);
      }
    }
    // Medir antes de traer: si no, una página enorme se copia entera a la memoria del relay.
    const length = Number(await tab.evaluate("document.documentElement.outerHTML.length"));
    if (length * 3 > MAX_BYTES) throw new Error("render: respuesta demasiado grande");
    return String(await tab.evaluate("document.documentElement.outerHTML"));
  };
  const work = run();
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    tab.close();
    // Con la pestaña cerrada, lo que quede de `run` falla; no tiene que ensuciar la consola como rechazo sin manejar.
    work.catch(() => {});
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
