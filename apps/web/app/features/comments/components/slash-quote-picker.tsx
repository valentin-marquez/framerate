import { IconLayoutList, IconLoader2 } from "@tabler/icons-react";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useQuotes } from "~/features/quote/hooks/useQuotes";
import { getGradient } from "~/shared/utils/gradients";

export interface SlashState {
  /** Range in the textarea to be replaced on select (e.g. "/cot"). */
  start: number;
  end: number;
  /** The query after the slash (lowercase, may be empty). */
  query: string;
  /** Active row in the popover, controlled by keyboard. */
  activeIndex: number;
}

interface SlashQuotePickerProps {
  state: SlashState | null;
  onSelect: (quote: { id: string; name: string }) => void;
  onActiveChange: (nextIndex: number) => void;
  onClose: () => void;
  /**
   * Origin where the host (e.g. localhost:5173) lives — used to build the URL
   * we insert into the textarea so the renderer reliably matches it as a
   * quote URL.
   */
  origin: string;
}

const MIN_QUERY_FOR_OPEN = 0; // open with empty query too

/**
 * Discord-style slash command popover for inserting quote URLs into a comment.
 *
 * Lifecycle and state are owned by the parent CommentForm so that the
 * textarea's caret/selection stay authoritative. This component only renders
 * the list and reports back which row the user wants.
 */
export function SlashQuotePicker({ state, onSelect, onActiveChange, onClose, origin }: SlashQuotePickerProps) {
  const open = state !== null;
  const query = state?.query ?? "";
  const activeIndex = state?.activeIndex ?? 0;

  const { data, isLoading, isError } = useQuotes(1, 20, { enabled: open });
  const all = data?.data ?? [];
  const filtered = useMemo(() => {
    if (!query) return all;
    return all.filter((q) => q.name.toLowerCase().includes(query));
  }, [all, query]);

  // Clamp activeIndex into the filtered list whenever it changes.
  const listLength = filtered.length;
  useEffect(() => {
    if (!open) return;
    if (activeIndex >= listLength && listLength > 0) {
      onActiveChange(0);
    }
  }, [open, activeIndex, listLength, onActiveChange]);

  const listRef = useRef<HTMLUListElement | null>(null);
  // Keep the active row in view when keyboard nav scrolls past the visible area.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-row-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  if (query.length < MIN_QUERY_FOR_OPEN) return null;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
            role="listbox"
            aria-label="Cotizaciones para insertar"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium border-b border-border/60 flex items-center justify-between">
              <span>Tus cotizaciones {query && `· "${query}"`}</span>
              <kbd className="text-[10px] text-muted-foreground/70 font-mono">esc</kbd>
            </div>
            <ul ref={listRef} className="max-h-72 overflow-y-auto py-1">
              {isLoading && (
                <li className="px-3 py-3 text-sm text-muted-foreground inline-flex items-center gap-2">
                  <IconLoader2 className="size-3.5 animate-spin" />
                  Cargando…
                </li>
              )}
              {isError && (
                <li className="px-3 py-3 text-sm text-rose-600 dark:text-rose-400">No se pudieron cargar.</li>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <li className="px-3 py-3 text-sm text-muted-foreground italic">
                  {all.length === 0 ? "Aún no tienes cotizaciones." : "Sin coincidencias."}
                </li>
              )}
              {filtered.map((quote, idx) => {
                const itemCount = quote.quote_items?.[0]?.count ?? 0;
                const active = idx === activeIndex;
                return (
                  <li key={quote.id} data-row-index={idx}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => onActiveChange(idx)}
                      onClick={() => onSelect({ id: quote.id, name: quote.name })}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        active ? "bg-secondary/70" : "hover:bg-secondary/40"
                      }`}
                    >
                      <div
                        className="size-7 rounded-md flex items-center justify-center shrink-0 ring-1 ring-inset ring-white/10"
                        style={{ background: getGradient(quote.id) }}
                      >
                        <IconLayoutList className="size-3.5 text-white/90 drop-shadow-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{quote.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {itemCount} {itemCount === 1 ? "ítem" : "ítems"}
                          {quote.is_public ? "" : " · privada"}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 font-mono shrink-0">
                        {origin.replace(/^https?:\/\//, "")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground/70 flex items-center gap-3">
              <span>
                <kbd className="font-mono">↑↓</kbd> mover
              </span>
              <span>
                <kbd className="font-mono">↵</kbd> insertar
              </span>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto hover:text-foreground transition-colors"
                aria-label="Cerrar lista"
              >
                cerrar
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}

/**
 * Computes the slash trigger state given the textarea content and caret pos.
 * Returns `null` when no slash command is active under the cursor.
 *
 * Matches `/<word>` only when:
 *  - The slash is at start of the textarea, OR preceded by whitespace.
 *  - The caret is at the end of the word (no characters after).
 *  - The word so far is a prefix of one of the supported triggers.
 */
const TRIGGERS = ["cotizacion", "quote", "build"];

export function detectSlashCommand(
  value: string,
  cursor: number,
): { start: number; end: number; query: string } | null {
  const before = value.slice(0, cursor);
  const m = before.match(/(^|\s)\/([a-z0-9-]*)$/i);
  if (!m) return null;
  const matchedLen = m[0].length - m[1].length; // skip the leading whitespace
  const start = before.length - matchedLen;
  const query = m[2].toLowerCase();
  // Only show while the query is a prefix of a supported trigger.
  const ok = query === "" || TRIGGERS.some((t) => t.startsWith(query));
  if (!ok) return null;
  return { start, end: cursor, query };
}
