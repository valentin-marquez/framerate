/**
 * Cliente HTTP "educado" para scraping:
 *  - User-Agent honesto que identifica al bot.
 *  - Espera mínima entre requests al mismo host (no saturar tiendas chicas).
 *  - Timeout por request.
 *  - Reintentos con backoff exponencial sólo ante fallas transitorias (red, 429, 5xx).
 * `fetch` y `sleep` son inyectables para testear sin red.
 */

export const USER_AGENT = "FramerateBot/1.0 (+https://framerate.cl/bot; comparador de precios)";

export interface HttpClient {
  get(url: string, init?: { accept?: string; headers?: Record<string, string> }): Promise<HttpResponse>;
  /** POST con cuerpo JSON. Sólo para APIs de consulta (idempotentes): se reintenta igual que un GET. */
  post(url: string, json: unknown): Promise<HttpResponse>;
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  text: string;
}

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} en ${url}`);
    this.name = "HttpError";
  }
}

export interface HttpClientOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Espera mínima entre requests al mismo host. */
  minIntervalMs?: number;
  timeoutMs?: number;
  retries?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const minInterval = options.minIntervalMs ?? 750;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const retries = options.retries ?? 3;
  const lastRequestAt = new Map<string, number>();

  async function throttle(host: string) {
    const last = lastRequestAt.get(host);
    if (last !== undefined) {
      const wait = last + minInterval - Date.now();
      if (wait > 0) await sleep(wait);
    }
    lastRequestAt.set(host, Date.now());
  }

  async function request(url: string, init: { headers: Record<string, string>; method?: string; body?: string }) {
    const host = new URL(url).host;
    for (let attempt = 0; ; attempt++) {
      await throttle(host);
      try {
        const res = await doFetch(url, {
          method: init.method,
          body: init.body,
          headers: { "User-Agent": USER_AGENT, ...init.headers },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.ok) return { status: res.status, headers: res.headers, text: await res.text() };
        const transient = res.status === 429 || res.status >= 500;
        if (!transient || attempt >= retries) throw new HttpError(url, res.status);
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      } catch (error) {
        if (error instanceof HttpError || attempt >= retries) throw error;
        await sleep(backoff(attempt));
      }
    }
  }

  return {
    get: (url, init) => request(url, { headers: { Accept: init?.accept ?? "application/json", ...init?.headers } }),
    post: (url, json) =>
      request(url, {
        method: "POST",
        body: JSON.stringify(json),
        headers: { Accept: "application/json", "Content-Type": "application/json" },
      }),
  };
}

const backoff = (attempt: number) => 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
