import type { ClickSource } from "@framerate/contracts";

/** Desde dónde sale el clic: es el `utm_campaign` del link y el `source` que registra `POST /v1/clicks`. */
export type OutboundSource = ClickSource;

const UTM_SOURCE = "framerate.cl";
const UTM_MEDIUM = "referral";

/**
 * Decora una URL externa con UTM params para que el partner identifique el
 * tráfico como originado en Framerate. Preserva el query string existente del
 * link original; sobreescribe utm_* si vinieran (no debería pasar pero por si
 * acaso).
 */
export function buildOutboundUrl(targetUrl: string, source: OutboundSource): string {
  if (!targetUrl) return targetUrl;
  try {
    const url = new URL(targetUrl);
    url.searchParams.set("utm_source", UTM_SOURCE);
    url.searchParams.set("utm_medium", UTM_MEDIUM);
    url.searchParams.set("utm_campaign", source);
    return url.toString();
  } catch {
    // URL inválida (ej. relativa): devolvemos tal cual y el navegador decide.
    return targetUrl;
  }
}
