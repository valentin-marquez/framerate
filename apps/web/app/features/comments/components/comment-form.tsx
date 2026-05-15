import { useState } from "react";
import { useAuthStore } from "~/features/auth/store/auth";
import { Button } from "~/shared/components/primitives/button";
import { Textarea } from "~/shared/components/primitives/textarea";
import { cn } from "~/shared/lib/utils";

interface CommentFormProps {
  onSubmit: (body: string) => Promise<void> | void;
  onCancel?: () => void;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  busy?: boolean;
  autoFocus?: boolean;
  className?: string;
}

const MAX_LEN = 5000;

export function CommentForm({
  onSubmit,
  onCancel,
  placeholder = "Comparte tu opinión…",
  initialValue = "",
  submitLabel = "Publicar",
  busy,
  autoFocus,
  className,
}: CommentFormProps) {
  const user = useAuthStore((s) => s.user);
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  const isAuthed = !!user;
  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX_LEN;
  const canSubmit = isAuthed && trimmed.length > 0 && !tooLong && !busy && !submitting;

  const handle = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await onSubmit(trimmed);
      setValue("");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthed) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-card p-3 text-sm text-muted-foreground", className)}>
        Inicia sesión para comentar.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        autoFocus={autoFocus}
        aria-invalid={tooLong || undefined}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn("text-xs", tooLong ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground")}
        >
          {trimmed.length}/{MAX_LEN}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting || busy}>
              Cancelar
            </Button>
          )}
          <Button size="sm" onClick={handle} disabled={!canSubmit}>
            {submitting || busy ? "Enviando…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
