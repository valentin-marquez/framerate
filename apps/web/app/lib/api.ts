const API_URL =
  typeof import.meta.env.VITE_API_URL === "string" ? import.meta.env.VITE_API_URL.trim() : import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.warn("VITE_API_URL is not defined, defaulting to http://127.0.0.1:8787");
}

const BASE_URL = API_URL || "http://127.0.0.1:8787";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
  token?: string; // Para requests autenticados
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function fetcher<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, token, ...init } = options;

  const url = new URL(`${BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
  }

  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers,
  });

  if (!response.ok) {
    let errorData: { message?: string; error?: string } | Record<string, unknown>;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const errorMessage =
      typeof errorData.message === "string"
        ? errorData.message
        : typeof errorData.error === "string"
          ? errorData.error
          : "An error occurred";

    throw new ApiError(response.status, errorMessage, errorData);
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
};
