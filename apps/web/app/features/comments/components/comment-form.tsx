import { domAnimation, LazyMotion, m } from "motion/react";
import { useCallback, useId, useRef, useState } from "react";
import { useAuthStore } from "~/features/auth/store/auth";
import { useQuotePasteWatcher } from "~/features/comments/components/quote-paste-dialog";
import { RichCommentInput, type RichCommentInputHandle } from "~/features/comments/components/rich-comment-input";
import {
  detectSlashCommand,
  SlashQuotePicker,
  type SlashState,
} from "~/features/comments/components/slash-quote-picker";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";

interface CommentFormProps {
  onSubmit: (body: string) => Promise<void> | void;
  onCancel?: () => void;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  busy?: boolean;
  className?: string;
  /**
   * When true the field stays collapsed (only the input visible) until focused
   * or filled. Used by the top-level "Escribe un comentario" composer.
   */
  compact?: boolean;
}

const MAX_LEN = 5000;

export function CommentForm({
  onSubmit,
  onCancel,
  placeholder = "Comparte tu opinión…",
  initialValue = "",
  submitLabel = "Publicar",
  busy,
  className,
  compact = false,
}: CommentFormProps) {
  const user = useAuthStore((s) => s.user);
  // react-doctor-disable-next-line no-derived-useState -- prop re-seed via useRef es el patrón oficial de React docs
  const [value, setValue] = useState(initialValue);
  const prevInitialRef = useRef(initialValue);
  if (initialValue !== prevInitialRef.current) {
    prevInitialRef.current = initialValue;
    setValue(initialValue);
  }
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const paste = useQuotePasteWatcher();
  const editorRef = useRef<RichCommentInputHandle | null>(null);
  const [slashState, setSlashState] = useState<SlashState | null>(null);
  const containerId = useId();

  const isAuthed = !!user;
  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX_LEN;
  const canSubmit = isAuthed && trimmed.length > 0 && !tooLong && !busy && !submitting;
  const expanded = !compact || focused || trimmed.length > 0;

  const updateSlashFromCursor = useCallback((nextValue: string, caret: number) => {
    const detected = detectSlashCommand(nextValue, caret);
    setSlashState((prev) => {
      if (!detected) return null;
      if (prev && prev.start === detected.start) {
        return { ...detected, activeIndex: prev.activeIndex };
      }
      return { ...detected, activeIndex: 0 };
    });
  }, []);

  const handleChange = (next: string) => {
    setValue(next);
    const caret = editorRef.current?.getCaretOffset() ?? next.length;
    updateSlashFromCursor(next, caret);
  };

  const handleCaretMove = (caret: number) => {
    updateSlashFromCursor(value, caret);
  };

  const handleSelect = (quote: { id: string; name: string }) => {
    if (!slashState || !editorRef.current) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/cotizacion/${quote.id}`;
    editorRef.current.insertQuoteBadge(slashState.start, slashState.end, { quoteId: quote.id, href: url });
    setSlashState(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!slashState) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setSlashState(null);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSlashState((p) => (p ? { ...p, activeIndex: p.activeIndex + 1 } : p));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSlashState((p) => (p ? { ...p, activeIndex: Math.max(0, p.activeIndex - 1) } : p));
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      const node = document
        .getElementById(containerId)
        ?.querySelector<HTMLElement>(`[data-row-index="${slashState.activeIndex}"] button`);
      if (node) {
        e.preventDefault();
        node.click();
      }
    }
  };

  const handle = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await onSubmit(trimmed);
      editorRef.current?.clear();
      setValue("");
      setFocused(false);
      setSlashState(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    if (compact) {
      editorRef.current?.clear();
      setValue("");
      setFocused(false);
    }
  };

  if (!isAuthed) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-card p-3 text-sm text-muted-foreground", className)}>
        Inicia sesión para comentar.
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "framerate.cl";

  return (
    <LazyMotion features={domAnimation}>
      <div className="relative" id={containerId}>
        <div
          className={cn(
            "rounded-xl border bg-input/30 transition-all duration-200",
            focused || trimmed.length > 0
              ? "border-ring/50 ring-[3px] ring-ring/15 shadow-sm"
              : "border-border/60 hover:border-border",
            className,
          )}
        >
          <RichCommentInput
            ref={editorRef}
            value={value}
            onChange={handleChange}
            onCaretMove={handleCaretMove}
            onPasteText={(text) => {
              paste.handlePasteText(text);
              return false;
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setTimeout(() => setSlashState(null), 120);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            expanded={expanded}
            ariaInvalid={tooLong}
          />

          {expanded && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/40">
                <span
                  className={cn(
                    "text-[11px]",
                    tooLong ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground/80",
                  )}
                >
                  {trimmed.length}/{MAX_LEN}
                </span>
                <div className="flex items-center gap-1">
                  {(onCancel || compact) && (
                    <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting || busy}>
                      Cancelar
                    </Button>
                  )}
                  <Button size="sm" onClick={handle} disabled={!canSubmit}>
                    {submitting || busy ? "Enviando…" : submitLabel}
                  </Button>
                </div>
              </div>
            </m.div>
          )}
        </div>

        <SlashQuotePicker
          state={slashState}
          onSelect={handleSelect}
          onActiveChange={(idx) => setSlashState((p) => (p ? { ...p, activeIndex: idx } : p))}
          onClose={() => setSlashState(null)}
          origin={origin}
        />
      </div>
      {paste.node}
    </LazyMotion>
  );
}
