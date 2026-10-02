import type { CommentSort } from "@framerate/contracts";
import { domMax, LazyMotion, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CommentForm } from "~/features/comments/components/comment-form";
import { CommentThread } from "~/features/comments/components/comment-thread";
import { useCreateComment, useProductComments } from "~/features/comments/hooks/useComments";
import { Button } from "~/shared/components/primitives/button";
import { DURATION, EASE_IN_OUT } from "~/shared/lib/motion";
import { cn } from "~/shared/lib/utils";

interface CommentsSectionProps {
  productId: number;
  className?: string;
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const SORTS = [
  { key: "best", label: "Mejores" },
  { key: "recent", label: "Recientes" },
  { key: "old", label: "Antiguos" },
] as const;

export function CommentsSection({ productId, className }: CommentsSectionProps) {
  const [sort, setSort] = useState<CommentSort>("best");
  // ponytail: "Ver más" agranda pageSize (tope 100 del contrato); paginar de verdad si un producto pasa de ahí.
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const { data, isLoading, error } = useProductComments(productId, sort, pageSize);
  const createMutation = useCreateComment(productId);
  const [newCommentId, setNewCommentId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const handleCreate = async (body: string) => {
    const result = await createMutation.mutateAsync({ body });
    setSort("recent");
    setNewCommentId(result.id);
  };

  const listLength = data?.items.length ?? 0;
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

  const count = data?.total ?? 0;

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
                    "relative px-2.5 py-1 rounded-md transition-colors",
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
                      transition={{ duration: DURATION.base, ease: EASE_IN_OUT }}
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
          {data?.items.map((root) => (
            <m.div key={root.id} layout="position" transition={{ duration: DURATION.base, ease: EASE_IN_OUT }}>
              <CommentThread productId={productId} root={root} />
            </m.div>
          ))}
          {data && data.items.length === 0 && !isLoading && (
            <div className="text-sm text-muted-foreground text-center py-6 italic">
              Aún no hay comentarios. ¡Sé el primero!
            </div>
          )}
        </div>

        {data && data.total > data.items.length && pageSize < MAX_PAGE_SIZE && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPageSize((n) => Math.min(n + PAGE_SIZE, MAX_PAGE_SIZE))}
            >
              Ver más
            </Button>
          </div>
        )}
      </section>
    </LazyMotion>
  );
}
