import type { OutboundSource } from "~/shared/utils/outbound";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";

export interface OutboundClickPayload {
  source: OutboundSource;
  /** URL final (con utm_*) que se abrió en el navegador. */
  target_url: string;
  /** Path interno desde donde se hizo click (ej. "/producto/rtx-4090-msi"). */
  referrer_path?: string;
  listing_id?: string | null;
  store_id?: string | null;
  product_id?: string | null;
}

/**
 * Dispara un registro de click saliente. Best-effort: no bloquea ni espera.
 *
 * Usa `fetch` con `keepalive: true` para que el request sobreviva incluso si
 * el usuario navega/cierra la pestaña antes de que termine. Las excepciones se
 * silencian — analítica no debe romper la UX.
 */
export function recordOutboundClick(payload: OutboundClickPayload, accessToken?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    void fetch(`${API_URL}/v1/clicks`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
