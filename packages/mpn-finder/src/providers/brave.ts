/**
 * @module mpn-finder/providers/brave
 *
 * `SearchProvider` sobre la Brave Search API (`/res/v1/web/search`).
 *
 * A diferencia del scraping de DuckDuckGo, es una API JSON estable: resultados
 * consistentes, sin rate-limiting agresivo ni layout que cambie. Requiere una
 * API key (`BRAVE_SEARCH_API_KEY`). Sin la key, `search()` devuelve `[]` — así
 * el orquestador puede caer a otro proveedor sin romperse.
 */

import type { SearchProvider, SearchResult } from "../types";

/** Endpoint de búsqueda web de la Brave Search API. */
const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

/** Tope de resultados por request que admite la API (`count`). */
const MAX_COUNT = 20;

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

/** Quita tags HTML (Brave resalta términos con `<strong>`) y colapsa espacios. */
function cleanText(text: string | undefined): string {
  return (text ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `SearchProvider` que consulta la Brave Search API. */
export class BraveSearchProvider implements SearchProvider {
  readonly name = "brave";
  private readonly apiKey: string | undefined;

  /** La API key se puede inyectar; por defecto sale de `BRAVE_SEARCH_API_KEY`. */
  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.BRAVE_SEARCH_API_KEY;
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    if (!query || query.trim().length === 0 || limit <= 0) return [];
    // Sin API key no se puede consultar — el orquestador caerá a otro proveedor.
    if (!this.apiKey) return [];

    try {
      const count = Math.min(Math.max(limit, 1), MAX_COUNT);
      const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
      });

      // No-200 (rate limit, key inválida, etc.) → tratar como sin resultados.
      if (!response.ok) return [];

      const body = (await response.json()) as BraveResponse;
      const results = body.web?.results ?? [];

      return results
        .map((r) => ({
          title: cleanText(r.title),
          snippet: cleanText(r.description),
          url: (r.url ?? "").trim(),
        }))
        .filter((r) => r.title.length > 0 && r.url.length > 0)
        .slice(0, limit);
    } catch {
      // Cualquier error de red/parseo → devolver vacío, nunca lanzar.
      return [];
    }
  }
}
