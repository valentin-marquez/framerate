/**
 * Detects framerate quote URLs inside free-form text.
 *
 * Shared between the comment renderer (turns matches into <QuoteEmbed>) and
 * the comment form's paste handler (offers to publish private quotes inline).
 */

// `public_id` of a quote: 10 uppercase characters without 0, 1, I, L, O or U (`newPublicId(10)` in the server's
// quotes repository). Case matters: the API compares it as written, so it is never lowercased.
const QUOTE_URL_RE =
  /https?:\/\/(?:framerate\.cl|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)\/cotizacion\/([A-HJKMNP-TV-Z2-9]{10})\b/g;

export interface QuoteUrlMatch {
  start: number;
  end: number;
  url: string;
  quoteId: string;
}

export function findQuoteUrls(text: string): QuoteUrlMatch[] {
  return Array.from(text.matchAll(QUOTE_URL_RE), (m) => ({
    start: m.index,
    end: m.index + m[0].length,
    url: m[0],
    quoteId: m[1] as string,
  }));
}
