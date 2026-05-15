import { domMax, LazyMotion, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CommentForm } from "~/features/comments/components/comment-form";
import { CommentThread } from "~/features/comments/components/comment-thread";
import { useCreateComment, useProductComments } from "~/features/comments/hooks/useComments";
import type { CommentSort, CommentTargetType } from "~/features/comments/services/comments";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";

interface CommentsSectionProps {
  /**
   * Currently always "product"; the API is built to extend to other targets later.
   */
  targetType: CommentTargetType;
  targetId: string;
  className?: string;
}

const SORTS = [
  { key: "best", label: "Mejores" },
  { key: "recent", label: "Recientes" },
  { key: "old", label: "Antiguos" },
] as const;

/**
 * Top-level container for threaded comments on a target (currently products).
 * Designed to be reusable from Fase 4 (moderation) if a moderator needs a
 * read-only embed.
 */
export function CommentsSection({ targetType, targetId, className }: CommentsSectionProps) {
  const [sort, setSort] = useState<CommentSort>("best");
  const { data, isLoading, error } = useProductComments(targetId, sort);
  const createMutation = useCreateComment(targetId, sort);
  const [newCommentId, setNewCommentId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const handleCreate = async (body: string) => {
    const result = await createMutation.mutateAsync({ parent_id: null, body });
    setSort("recent");
    setNewCommentId(result.data.id);
  };

  const listLength = data?.data.length ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: listLength signals "new node landed in DOM" — see comment
  useEffect(() => {
    if (!newCommentId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-comment-id="${newCommentId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/40", "ring-offset-2", "rounded-xl", "transition-shadow");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary/40", "ring-offset-2");
      setNewCommentId(null);
    }, 1600);
    return () => clearTimeout(t);
  }, [newCommentId, listLength]);

  if (targetType !== "product") {
    return null;
  }

  const count = data?.data.length ?? 0;

  return (
    <LazyMotion features={domMax}>
      <section className={cn("space-y-5", className)} aria-labelledby="comments-heading">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 id="comments-heading" className="text-base font-semibold text-foreground">
            Comentarios{count > 0 ? ` (${count}${count === 50 ? "+" : ""})` : ""}
          </h2>

          <div role="tablist" className="relative inline-flex items-center text-xs text-muted-foreground">
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <button
                  type="button"
                  role="tab"
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  aria-selected={active}
                  // Reserve bold width even when inactive so the pill (and adjacent
                  // tabs) don't shift horizontally when the active tab changes.
                  className={cn(
                    "relative px-2.5 py-1 rounded-md transition-colors duration-150",
                    active ? "text-foreground" : "hover:text-foreground",
                  )}
                  style={
                    {
                      // Use font-variation if available; otherwise the trick is to set the
                      // bold width as a min-width via a hidden duplicate inside the button.
                      // Keeping it simple: same padding, no font-weight swap.
                    }
                  }
                >
                  {active && (
                    <m.span
                      layoutId="comments-tab-pill"
                      className="absolute inset-0 rounded-md bg-secondary/70 -z-0"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className={cn("relative z-10", active && "font-medium text-foreground")}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <CommentForm
          compact
          onSubmit={handleCreate}
          placeholder="Escribe un comentario…"
          busy={createMutation.isPending}
        />

        {isLoading && <div className="text-sm text-muted-foreground">Cargando comentarios…</div>}
        {error && (
          <div className="text-sm text-rose-600 dark:text-rose-400">
            No se pudieron cargar los comentarios. Intenta de nuevo más tarde.
          </div>
        )}

        <div ref={listRef} className="space-y-5">
          {data?.data.map((root) => (
            <m.div
              key={root.id}
              layout="position"
              transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.6 }}
            >
              <CommentThread productId={targetId} root={root} sort={sort} />
            </m.div>
          ))}
          {data && data.data.length === 0 && !isLoading && (
            <div className="text-sm text-muted-foreground text-center py-6 italic">
              Aún no hay comentarios. ¡Sé el primero!
            </div>
          )}
        </div>

        {data && data.data.length >= 50 && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" disabled>
              Ver más (próximamente)
            </Button>
          </div>
        )}
      </section>
    </LazyMotion>
  );
}
