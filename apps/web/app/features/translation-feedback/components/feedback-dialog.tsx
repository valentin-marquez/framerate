import { IconCheck, IconSearch, IconSend, IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "~/features/auth/store/auth";
import { translationFeedbackService } from "~/features/translation-feedback/services/translation-feedback";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Textarea } from "~/shared/components/primitives/textarea";
import { useTranslation } from "~/shared/hooks/use-translation";
import { dictionaries, type Lang } from "~/shared/lib/translations";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
}

interface DictEntry {
  key: string;
  current: string;
  reference: string; // Spanish source text for context
}

export function FeedbackDialog({ open, onOpenChange, lang }: FeedbackDialogProps) {
  const { supabase } = useAuthStore();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const entries = useMemo<DictEntry[]>(() => {
    const langDict = dictionaries[lang] ?? {};
    const esDict = dictionaries.es;
    return Object.keys(langDict)
      .map((key) => ({ key, current: langDict[key] ?? "", reference: esDict[key] ?? "" }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [lang]);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) || e.current.toLowerCase().includes(q) || e.reference.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const selected = useMemo(
    () => (selectedKey ? (entries.find((e) => e.key === selectedKey) ?? null) : null),
    [entries, selectedKey],
  );

  const reset = () => {
    setQuery("");
    setSelectedKey(null);
    setSuggestion("");
    setComment("");
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const submit = async () => {
    if (!selected) return;
    const trimmed = suggestion.trim();
    if (trimmed.length === 0) {
      toast.error(t("feedback_empty_error"));
      return;
    }
    if (trimmed === selected.current) {
      toast.error(t("feedback_same_error"));
      return;
    }

    setSubmitting(true);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      await translationFeedbackService.submit(
        {
          lang,
          translation_key: selected.key,
          current_text: selected.current,
          suggested_text: trimmed,
          comment: comment.trim() || undefined,
          context_url: typeof window !== "undefined" ? window.location.href : undefined,
        },
        token,
      );
      toast.success(t("feedback_sent"));
      close();
    } catch (e) {
      console.error(e);
      toast.error(t("feedback_send_error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-border/60">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("feedback_dialog_title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("feedback_dialog_desc")}</p>
          </div>
          <button
            type="button"
            aria-label={t("feedback_close")}
            onClick={close}
            className="rounded-full p-1 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconX className="size-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-4 p-5 overflow-hidden">
          {!selected ? (
            <>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("feedback_search_placeholder")}
                  className="pl-9"
                />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                {filtered.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground text-center">{t("feedback_no_matches")}</div>
                ) : (
                  filtered.slice(0, 100).map((e) => (
                    <button
                      type="button"
                      key={e.key}
                      onClick={() => {
                        setSelectedKey(e.key);
                        setSuggestion(e.current);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-secondary/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <code className="text-xs text-muted-foreground font-mono shrink-0">{e.key}</code>
                        {e.reference && e.reference !== e.current && (
                          <span className="text-[10px] text-muted-foreground/70 truncate">es: {e.reference}</span>
                        )}
                      </div>
                      <div className="text-sm mt-0.5 line-clamp-2">
                        {e.current || <em className="text-muted-foreground">{t("feedback_empty_value")}</em>}
                      </div>
                    </button>
                  ))
                )}
                {filtered.length > 100 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    {t("feedback_showing_some", { total: filtered.length })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-muted-foreground">{selected.key}</code>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKey(null);
                      setSuggestion("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {t("feedback_change")}
                  </button>
                </div>
                {selected.reference && selected.reference !== selected.current && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">es: </span>
                    <span>{selected.reference}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs">
                    {t("feedback_current")} ({lang}):{" "}
                  </span>
                  <span>{selected.current}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="feedback-suggestion" className="text-sm font-medium">
                  {t("feedback_your_suggestion")}
                </label>
                <Textarea
                  id="feedback-suggestion"
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder={t("feedback_suggestion_placeholder")}
                  maxLength={2000}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="feedback-comment" className="text-sm font-medium">
                  {t("feedback_comment")}{" "}
                  <span className="text-muted-foreground font-normal">{t("feedback_optional")}</span>
                </label>
                <Textarea
                  id="feedback-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("feedback_comment_placeholder")}
                  maxLength={2000}
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border/60">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={
              !selected || submitting || suggestion.trim() === selected?.current || suggestion.trim().length === 0
            }
            className="gap-2"
          >
            {submitting ? <IconCheck className="size-4" /> : <IconSend className="size-4" />}
            {submitting ? t("feedback_sending") : t("feedback_send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
