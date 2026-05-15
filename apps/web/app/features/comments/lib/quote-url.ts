/**
 * Detects framerate quote URLs inside free-form text.
 *
 * Shared between the comment renderer (turns matches into <QuoteEmbed>) and
 * the comment form's paste handler (offers to publish private quotes inline).
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const QUOTE_URL_RE =
  /https?:\/\/(?:framerate\.cl|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)\/cotizacion\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi;

export function isQuoteUrl(url: string): string | null {
  const single = new RegExp(QUOTE_URL_RE.source, "i");
  const match = single.exec(url);
  return match ? match[1].toLowerCase() : null;
}

export interface QuoteUrlMatch {
  start: number;
  end: number;
  url: string;
  quoteId: string;
}

export function findQuoteUrls(text: string): QuoteUrlMatch[] {
  const matches: QuoteUrlMatch[] = [];
  const re = new RegExp(QUOTE_URL_RE.source, "gi");
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    const id = UUID_RE.exec(m[0])?.[0]?.toLowerCase();
    if (id) {
      matches.push({ start: m.index, end: m.index + m[0].length, url: m[0], quoteId: id });
    }
    m = re.exec(text);
  }
  return matches;
}
