import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QuoteEmbed } from "~/features/comments/components/quote-embed";
import { findQuoteUrls } from "~/features/comments/lib/quote-url";
import { cn } from "~/shared/lib/utils";

export interface RichCommentInputHandle {
  /** Focuses the editor and places the caret at the end of the content. */
  focus(): void;
  /** Returns the caret offset relative to the serialized value. */
  getCaretOffset(): number;
  /**
   * Replaces a slice [start, end) of the serialized value with a quote badge
   * followed by a space. Used by the slash-command picker and the paste
   * watcher when inlining a quote URL.
   */
  insertQuoteBadge(start: number, end: number, params: { quoteId: string; href: string }): void;
  /** Resets the editor content to the empty state. */
  clear(): void;
}

interface RichCommentInputProps {
  value: string;
  onChange: (next: string) => void;
  onCaretMove?: (offset: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onPasteText?: (text: string) => boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
  /** Rough min-height matching `<textarea rows={N}>` semantics. */
  expanded?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ref?: React.Ref<RichCommentInputHandle>;
}

/**
 * Notion/Linear-style inline-rich comment input.
 *
 * - Backing model is a plain string (the eventual comment body). The visible
 *   layer is a `contenteditable` div that re-shapes quote URLs into inline
 *   <QuoteBadge> chips so the writer sees the comment as it'll render.
 * - The `value` prop is the source of truth on mount and on programmatic
 *   reset. Subsequent edits drive `onChange` and we deliberately do *not*
 *   re-write the DOM from `value` on every parent rerender — that would
 *   collapse the caret on every keystroke.
 */
export function RichCommentInput({
  value,
  onChange,
  onCaretMove,
  onFocus,
  onBlur,
  onPasteText,
  onKeyDown,
  placeholder = "Comparte tu opinión…",
  className,
  expanded = true,
  ariaInvalid,
  ariaDescribedBy,
  ref,
}: RichCommentInputProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  // Tracks the badge placeholders currently in the DOM, so we can portal a
  // React <QuoteEmbed> into each one.
  const [badgeHosts, setBadgeHosts] = useState<{ id: string; quoteId: string; href: string; node: HTMLElement }[]>([]);
  const idPrefix = useId();
  const isInitialized = useRef(false);

  // Initial seed + external resets.
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const serialized = serialize(root);
    if (!isInitialized.current || serialized !== value) {
      root.innerHTML = buildHtml(value, idPrefix);
      isInitialized.current = true;
      collectBadges(root, setBadgeHosts);
    }
  }, [value, idPrefix]);

  const emit = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    const serialized = serialize(root);
    onChange(serialized);
    collectBadges(root, setBadgeHosts);
  }, [onChange]);

  useImperativeHandle(
    ref,
    (): RichCommentInputHandle => ({
      focus() {
        const root = editorRef.current;
        if (!root) return;
        root.focus();
        // Caret at end
        const range = document.createRange();
        range.selectNodeContents(root);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      },
      getCaretOffset() {
        return editorRef.current ? getCaretOffset(editorRef.current) : 0;
      },
      insertQuoteBadge(start, end, params) {
        const root = editorRef.current;
        if (!root) return;
        replaceRangeWithBadge(root, start, end, params, idPrefix);
        // After mutation, push the new value + caret position back to the parent.
        emit();
        const newCaret = start + params.href.length + 1; // badge + trailing space
        setCaretOffset(root, newCaret);
        onCaretMove?.(newCaret);
      },
      clear() {
        const root = editorRef.current;
        if (!root) return;
        root.innerHTML = "";
        setBadgeHosts([]);
        onChange("");
      },
    }),
  );

  const handleInput = () => {
    emit();
    const offset = editorRef.current ? getCaretOffset(editorRef.current) : 0;
    onCaretMove?.(offset);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    // Let parent (paste watcher) inspect; if it returns true, it took over.
    onPasteText?.(text);
    e.preventDefault();
    // Native default would inject HTML. We force plain-text insertion at the
    // current selection, which lets `handleInput` normalize the URLs into
    // badges via the standard serialize → buildHtml pipeline.
    const root = editorRef.current;
    if (!root) return;
    insertTextAtCaret(text);
    emit();
    // If the pasted text contains quote URLs, replace them with badges
    // immediately so the writer sees the chip.
    const current = serialize(root);
    const hits = findQuoteUrls(current);
    if (hits.length > 0) {
      const caretBefore = getCaretOffset(root);
      root.innerHTML = buildHtml(current, idPrefix);
      collectBadges(root, setBadgeHosts);
      setCaretOffset(root, Math.min(caretBefore, current.length));
    }
    onCaretMove?.(getCaretOffset(root));
  };

  const handleKeyUp = () => {
    const root = editorRef.current;
    if (!root) return;
    onCaretMove?.(getCaretOffset(root));
  };

  const isEmpty = value.length === 0;

  return (
    <div className="relative">
      {/* biome-ignore lint/a11y/useSemanticElements: contenteditable rich input has no native HTML equivalent */}
      <div
        ref={editorRef}
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onPaste={handlePaste}
        onKeyDown={onKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleKeyUp}
        className={cn(
          "block w-full bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-foreground outline-none whitespace-pre-wrap break-words",
          "transition-[min-height] duration-200 ease-out",
          expanded ? "min-h-20" : "min-h-9",
          className,
        )}
      />
      {isEmpty && (
        <span
          aria-hidden="true"
          className="absolute top-2.5 left-3.5 text-sm leading-relaxed text-muted-foreground pointer-events-none select-none"
        >
          {placeholder}
        </span>
      )}
      {badgeHosts.map((host) =>
        createPortal(<InlineQuoteChip quoteId={host.quoteId} href={host.href} />, host.node, host.id),
      )}
    </div>
  );
}

/**
 * Compact chip rendered inside the contenteditable for the "writing" view.
 * It reuses the same QuoteEmbed component the comment-renderer uses, so the
 * preview matches the final post 1:1 — including the morph-to-quick-view
 * interaction. We stop bubbling/mousedown so the contenteditable doesn't
 * fight us for the click.
 */
function InlineQuoteChip({ quoteId, href }: { quoteId: string; href: string }) {
  // Caret-preserving stoppers: contenteditable parents would otherwise grab
  // the click to position the caret inside this non-editable chip. We delegate
  // the actual button + keyboard handling to <QuoteEmbed>.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: span is a caret/event firewall around the inner button
    <span
      contentEditable={false}
      className="inline-block align-baseline mx-0.5 select-none cursor-pointer"
      onMouseDown={(e) => e.preventDefault()}
      onClick={stop}
      onKeyDown={stop}
    >
      <QuoteEmbed quoteId={quoteId} href={href} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// DOM <-> string utilities
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(value: string, idPrefix: string): string {
  const hits = findQuoteUrls(value);
  let out = "";
  let cursor = 0;
  hits.forEach((hit, idx) => {
    if (hit.start > cursor) {
      out += escapeHtml(value.slice(cursor, hit.start)).replace(/\n/g, "<br>");
    }
    out += `<span data-quote-id="${escapeHtml(hit.quoteId)}" data-href="${escapeHtml(hit.url)}" data-badge-id="${idPrefix}-${idx}" contenteditable="false"></span>`;
    cursor = hit.end;
  });
  if (cursor < value.length) {
    out += escapeHtml(value.slice(cursor)).replace(/\n/g, "<br>");
  }
  return out;
}

function collectBadges(
  root: HTMLElement,
  set: React.Dispatch<React.SetStateAction<{ id: string; quoteId: string; href: string; node: HTMLElement }[]>>,
) {
  const spans = Array.from(root.querySelectorAll<HTMLElement>("[data-quote-id]"));
  set(
    spans
      .filter((node) => !!node.dataset.quoteId)
      .map((node) => ({
        id: node.dataset.badgeId || `${node.dataset.quoteId}-${nodeIndex(node)}`,
        quoteId: node.dataset.quoteId as string,
        href: node.dataset.href || `/cotizacion/${node.dataset.quoteId}`,
        node,
      })),
  );
}

function nodeIndex(node: Node): number {
  let i = 0;
  let cur = node.previousSibling;
  while (cur) {
    i++;
    cur = cur.previousSibling;
  }
  return i;
}

export function serializeFromDom(root: HTMLElement): string {
  return serialize(root);
}

function serialize(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.nodeName === "BR") {
      out += "\n";
      return;
    }
    if (el.dataset?.href) {
      out += el.dataset.href;
      return;
    }
    if (el.nodeName === "DIV" && out && !out.endsWith("\n")) {
      out += "\n";
    }
    for (const child of Array.from(el.childNodes)) walk(child);
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return out;
}

function measureNode(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue?.length ?? 0;
  if (node.nodeName === "BR") return 1;
  const el = node as HTMLElement;
  if (el.dataset?.href) return el.dataset.href.length;
  let n = 0;
  for (const c of Array.from(node.childNodes)) n += measureNode(c);
  return n;
}

function getCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;

  let offset = 0;
  let done = false;
  const walk = (node: Node) => {
    if (done) return;
    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.startOffset;
      } else {
        for (let i = 0; i < range.startOffset; i++) {
          offset += measureNode(node.childNodes[i]);
        }
      }
      done = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.nodeValue?.length ?? 0;
      return;
    }
    const el = node as HTMLElement;
    if (el.nodeName === "BR") {
      offset += 1;
      return;
    }
    if (el.dataset?.href) {
      offset += el.dataset.href.length;
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
      if (done) return;
    }
  };
  walk(root);
  return offset;
}

function setCaretOffset(root: HTMLElement, target: number) {
  let remaining = target;
  let foundNode: Node | null = null;
  let foundOffset = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.nodeValue?.length ?? 0;
      if (remaining <= len) {
        foundNode = node;
        foundOffset = remaining;
        return true;
      }
      remaining -= len;
      return false;
    }
    const el = node as HTMLElement;
    if (el.nodeName === "BR") {
      const parent = el.parentNode;
      if (parent && remaining === 0) {
        foundNode = parent;
        foundOffset = Array.prototype.indexOf.call(parent.childNodes, el);
        return true;
      }
      remaining -= 1;
      return false;
    }
    if (el.dataset?.href) {
      const len = el.dataset.href.length;
      const parent = el.parentNode;
      if (parent && remaining <= len) {
        const idx = Array.prototype.indexOf.call(parent.childNodes, el);
        foundNode = parent;
        foundOffset = remaining === 0 ? idx : idx + 1;
        return true;
      }
      remaining -= len;
      return false;
    }
    for (const c of Array.from(node.childNodes)) {
      if (walk(c)) return true;
    }
    return false;
  };
  walk(root);

  const range = document.createRange();
  if (foundNode) {
    range.setStart(foundNode, foundOffset);
  } else {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function insertTextAtCaret(text: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function replaceRangeWithBadge(
  root: HTMLElement,
  start: number,
  end: number,
  params: { quoteId: string; href: string },
  idPrefix: string,
) {
  // Regenerate the whole editor with the new content. Simpler than splicing
  // the DOM in place — the editor isn't expected to host huge documents.
  const current = serialize(root);
  const next = `${current.slice(0, start)}${params.href} ${current.slice(end)}`;
  root.innerHTML = buildHtml(next, idPrefix);
}
