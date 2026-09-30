const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.warn("VITE_API_URL is not defined, defaulting to http://127.0.0.1:8787");
} else {
  console.log("Using API_URL:", API_URL);
}

const BASE_URL = API_URL || "http://127.0.0.1:8787";

export const API_BASE_URL = BASE_URL;

type FetchOptions = RequestInit & {
  params?: Record<string, string | string[]>;
  /** Obsoleto e ignorado: la sesión es una cookie. Se elimina cuando cada feature migre a la API nueva. */
  token?: string;
};

/**
 * La sesión es una cookie de la API. En el navegador `credentials: "include"` la envía sola; en el SSR el
 * Worker registra aquí la cookie de la petición en curso y, en producción, el service binding hacia la API
 * (un Worker no puede llamar por HTTP público a otro Worker de su misma zona). Ver workers/app.ts.
 */
interface ServerContext {
  cookie?: string | null;
  /** IP del visitante: por el service binding la API no la ve, y sin ella todos comparten un límite. */
  ip?: string | null;
  fetch?: typeof fetch;
}

let serverContext: () => ServerContext | undefined = () => undefined;

export function setServerContext(provider: () => ServerContext | undefined) {
  serverContext = provider;
}

/** `fetch` hacia la API: por el service binding en el SSR de producción, `fetch` normal en el resto. */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== "undefined") return fetch(input, init);
  const context = serverContext();
  if (!context?.fetch) return fetch(input, init);
  const headers = new Headers(init?.headers);
  if (context.ip) headers.set("x-client-ip", context.ip);
  return context.fetch(input, { ...init, headers });
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  /** Código estable de la API (`username_taken`, `banned`…), si vino. */
  code?: string;

  constructor(status: number, message: string, data?: unknown, code?: string) {
    super(message);
    this.status = status;
    this.data = data;
    this.code = code;
  }

  /**
   * El backend está saturado o limitando este cliente. Loaders deben tratarlo
   * como una respuesta vacía suave (skeleton / empty state) en lugar de romper
   * con el error boundary.
   */
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/**
 * Helper para detectar errores 429 (rate limit) en loaders sin necesidad de
 * tipar `unknown` a mano. Devuelve true sólo si el error es una `ApiError`
 * con status === 429.
 */
export function isRateLimitError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 429;
}

async function fetcher<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, token: _token, ...init } = options;

  const url = new URL(`${BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Multi-select: append each value separately for duplicate keys
          for (const v of value) {
            url.searchParams.append(key, v);
          }
        } else {
          url.searchParams.append(key, value);
        }
      }
    });
  }

  const headers = new Headers(init.headers);

  // FormData define su propio Content-Type (con boundary); no lo pisamos.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const isBrowser = typeof window !== "undefined";
  if (!isBrowser) {
    const cookie = serverContext()?.cookie;
    if (cookie && !headers.has("cookie")) headers.set("cookie", cookie);
  }

  const response = await apiFetch(url.toString(), {
    ...init,
    headers,
    ...(isBrowser && { credentials: "include" as const }),
  });

  if (!response.ok) {
    let errorData: Record<string, unknown>;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    // Formato de la API: { error: { code, message } }. Se acepta también { message } / { error: "texto" }.
    const nested =
      typeof errorData.error === "object" && errorData.error !== null
        ? (errorData.error as Record<string, unknown>)
        : null;
    const errorMessage =
      typeof nested?.message === "string"
        ? nested.message
        : typeof errorData.message === "string"
          ? errorData.message
          : typeof errorData.error === "string"
            ? errorData.error
            : "An error occurred";

    throw new ApiError(
      response.status,
      errorMessage,
      errorData,
      typeof nested?.code === "string" ? nested.code : undefined,
    );
  }

  // Algunas respuestas DELETE no tienen body
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return {} as T;
}

export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) => fetcher<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body: unknown, options?: FetchOptions) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body: unknown, options?: FetchOptions) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body: unknown, options?: FetchOptions) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: <T>(endpoint: string, options?: FetchOptions) => fetcher<T>(endpoint, { ...options, method: "DELETE" }),

  /** POST multipart/form-data (uploads). No setea Content-Type manualmente. */
  upload: <T>(endpoint: string, form: FormData, options?: FetchOptions) =>
    fetcher<T>(endpoint, { ...options, method: "POST", body: form }),
};
