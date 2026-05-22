/**
 * @module mpn-finder/providers/duckduckgo
 *
 * `SearchProvider` sobre el endpoint HTML keyless de DuckDuckGo
 * (`https://html.duckduckgo.com/html/`). No requiere API key.
 *
 * Limitaciones conocidas: el HTML de DuckDuckGo no es una API estable —
 * las clases CSS (`result__a`, `result__snippet`) pueden cambiar sin aviso.
 * El parseo es por regex sobre el markup, así que es deliberadamente
 * tolerante: ante cualquier desviación devuelve lo que haya podido extraer
 * (o `[]`), nunca lanza. Si DuckDuckGo cambia el layout habrá que ajustar
 * los patrones de `parseResults`.
 */

import type { SearchProvider, SearchResult } from "../types";

/** UA realista de navegador (mismo formato que usan los crawlers del repo). */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Endpoint HTML sin API key de DuckDuckGo. */
const ENDPOINT = "https://html.duckduckgo.com/html/";

/**
 * Decodifica entidades HTML comunes y deja texto plano.
 * Cubre las entidades que aparecen de forma realista en títulos/snippets.
 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number.parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const n = Number.parseInt(code, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    });
}

/** Quita tags HTML, decodifica entidades y colapsa espacios. */
function cleanText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Desenvuelve los redirects de DuckDuckGo. Los links salen como
 * `/l/?uddg=<url-real-encodeada>` (o `//duckduckgo.com/l/?uddg=...`);
 * se extrae y decodifica el parámetro `uddg`. Si no es un redirect,
 * se devuelve la URL tal cual (decodificando entidades).
 */
function unwrapRedirectUrl(rawUrl: string): string {
  const url = decodeHtmlEntities(rawUrl.trim());
  // Detectar el patrón de redirect, con o sin host/protocolo.
  const match = url.match(/[?&]uddg=([^&]+)/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      // uddg malformado → devolver el redirect crudo como último recurso.
      return url;
    }
  }
  // Algunas variantes de DuckDuckGo devuelven URLs protocol-relative.
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

/**
 * Parsea el HTML de la página de resultados de DuckDuckGo a `SearchResult[]`.
 *
 * Se expone por separado de `search()` para poder testear el parseo con
 * fixtures fijos, sin requests de red. Cada resultado se identifica por su
 * link de título (clase `result__a`); el snippet (clase `result__snippet`)
 * se asocia al resultado más cercano. Tolerante: ignora bloques que no
 * matcheen en vez de fallar.
 */
export function parseResults(html: string): SearchResult[] {
  if (!html || typeof html !== "string") return [];

  const results: SearchResult[] = [];

  // Link de título: <a ... class="...result__a..." href="...">texto</a>
  const anchorRe = /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  // Snippet: <a|span ... class="...result__snippet..." ...>texto</a|span>
  const snippetRe = /<(?:a|span|div)\b[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span|div)>/gi;

  // Recolectar todos los snippets con su posición en el HTML, para
  // emparejarlos con el anchor de título que los precede.
  const snippets: { index: number; text: string }[] = [];
  for (let m = snippetRe.exec(html); m !== null; m = snippetRe.exec(html)) {
    snippets.push({ index: m.index, text: cleanText(m[1] ?? "") });
  }

  for (let m = anchorRe.exec(html); m !== null; m = anchorRe.exec(html)) {
    const href = m[1] ?? "";
    const title = cleanText(m[2] ?? "");
    if (!title || !href) continue;

    const url = unwrapRedirectUrl(href);
    if (!url) continue;

    // Emparejar con el primer snippet que aparezca después de este anchor
    // pero antes del siguiente anchor.
    const anchorEnd = m.index + m[0].length;
    const snippet = snippets.find((s) => s.index >= anchorEnd)?.text ?? "";

    results.push({ title, snippet, url });
  }

  return results;
}

/** `SearchProvider` que consulta el HTML keyless de DuckDuckGo. */
export class DuckDuckGoProvider implements SearchProvider {
  readonly name = "duckduckgo";

  async search(query: string, limit: number): Promise<SearchResult[]> {
    // Guardas de entrada: query vacía o limit no positivo → nada que hacer.
    if (!query || query.trim().length === 0 || limit <= 0) return [];

    try {
      const url = `${ENDPOINT}?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
        },
      });

      // No-200 → tratar como sin resultados (tolerante a fallos).
      if (!response.ok) return [];

      const html = await response.text();
      const results = parseResults(html);
      return results.slice(0, limit);
    } catch {
      // Cualquier error de red/parseo → devolver vacío, nunca lanzar.
      return [];
    }
  }
}
