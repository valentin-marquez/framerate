import type { ReactNode } from "react";
import { QuoteEmbed } from "~/features/comments/components/quote-embed";
import { findQuoteUrls } from "~/features/comments/lib/quote-url";
import { cn } from "~/shared/lib/utils";

interface CommentBodyProps {
  body: string;
  className?: string;
}

/**
 * Renders a comment body with light markup:
 *  - Triple-backtick fenced code blocks (with optional language tag).
 *  - Single-backtick inline code.
 *  - Quote URLs (framerate.cl or localhost) collapse into <QuoteEmbed> pills.
 *  - Any other http(s) URL becomes a plain link.
 *  - Plain text preserves whitespace and wraps long words.
 *
 * Deliberately tiny — no markdown library, no images. We tokenize fences first
 * so inline parsing never recurses into code.
 */
export function CommentBody({ body, className }: CommentBodyProps) {
  const segments = body.split(/```/);
  return (
    <div
      className={cn("text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words", className)}
      data-testid="comment-body"
    >
      {segments.map((seg, i) => {
        // Even indices are prose, odd indices are fenced code.
        const isCode = i % 2 === 1;
        if (isCode) {
          const { language, code } = stripLanguageTag(seg);
          return (
            <pre
              // biome-ignore lint/suspicious/noArrayIndexKey: order-stable, locally segmented
              key={`code-${i}`}
              className="my-2 rounded-md bg-muted text-foreground px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre"
              data-language={language || undefined}
            >
              <code>{code}</code>
            </pre>
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: order-stable, locally segmented
          <ProseSegment key={`prose-${i}`} text={seg} />
        );
      })}
    </div>
  );
}

function stripLanguageTag(raw: string): { language: string | null; code: string } {
  const trimmedStart = raw.replace(/^\n/, "");
  const newlineIdx = trimmedStart.indexOf("\n");
  if (newlineIdx === -1) return { language: null, code: trimmedStart };
  const firstLine = trimmedStart.slice(0, newlineIdx);
  if (/^[a-z0-9+\-#]{1,20}$/i.test(firstLine.trim())) {
    return { language: firstLine.trim(), code: trimmedStart.slice(newlineIdx + 1).replace(/\n$/, "") };
  }
  return { language: null, code: trimmedStart.replace(/\n$/, "") };
}

const URL_RE = /https?:\/\/[^\s<>"'`]+/g;

function ProseSegment({ text }: { text: string }) {
  // First pull out inline `code` so we don't try to detect URLs inside it.
  const parts: ReactNode[] = [];
  const inlineParts = text.split(/`([^`\n]+)`/g);
  inlineParts.forEach((part, idx) => {
    const isInlineCode = idx % 2 === 1;
    if (isInlineCode) {
      parts.push(
        <code
          // biome-ignore lint/suspicious/noArrayIndexKey: locally stable
          key={`ic-${idx}`}
          className="rounded bg-muted text-foreground px-1 py-0.5 text-[0.85em] font-mono"
        >
          {part}
        </code>,
      );
      return;
    }
    parts.push(...renderLinks(part, idx));
  });
  return <>{parts}</>;
}

function renderLinks(text: string, segmentIdx: number): ReactNode[] {
  const out: ReactNode[] = [];
  const quoteHits = findQuoteUrls(text);
  // Walk through both quote-url matches and generic URL matches in order.
  // Quote URLs take precedence because they're a strict subset of URL_RE.
  const urlIter = matchAll(text, URL_RE);

  type Hit =
    | { kind: "quote"; start: number; end: number; url: string; quoteId: string }
    | { kind: "url"; start: number; end: number; url: string };

  const hits: Hit[] = [];
  for (const q of quoteHits) hits.push({ kind: "quote", ...q });
  for (const u of urlIter) {
    // Skip if overlaps with a quote URL we already captured.
    if (quoteHits.some((q) => u.start < q.end && u.end > q.start)) continue;
    hits.push({ kind: "url", start: u.start, end: u.end, url: u.match });
  }
  hits.sort((a, b) => a.start - b.start);

  let cursor = 0;
  hits.forEach((hit) => {
    if (hit.start > cursor) out.push(text.slice(cursor, hit.start));
    // Hit ranges are unique offsets within the source text, so key collisions
    // are not possible across re-renders of the same body.
    const key = `${segmentIdx}-${hit.start}-${hit.end}`;
    if (hit.kind === "quote") {
      out.push(<QuoteEmbed key={`q-${key}`} quoteId={hit.quoteId} href={hit.url} />);
    } else {
      out.push(
        <a
          key={`u-${key}`}
          href={hit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline break-all"
        >
          {hit.url}
        </a>,
      );
    }
    cursor = hit.end;
  });

  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function matchAll(text: string, re: RegExp): { start: number; end: number; match: string }[] {
  const out: { start: number; end: number; match: string }[] = [];
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null = r.exec(text);
  while (m !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, match: m[0] });
    m = r.exec(text);
  }
  return out;
}
