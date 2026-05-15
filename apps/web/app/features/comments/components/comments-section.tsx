import { IconMessageCircle } from "@tabler/icons-react";
import { useState } from "react";
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

/**
 * Top-level container for threaded comments on a target (currently products).
 * Designed to be reusable from Fase 4 (moderation) if a moderator needs a
 * read-only embed.
 */
export function CommentsSection({ targetType, targetId, className }: CommentsSectionProps) {
  const [sort, setSort] = useState<CommentSort>("best");
  const { data, isLoading, error } = useProductComments(targetId, sort);
  const createMutation = useCreateComment(targetId, sort);

  // Currently only "product" targets are supported; bail after hooks to keep
  // hook order stable across renders.
  if (targetType !== "product") {
    return null;
  }

  const handleCreate = async (body: string) => {
    await createMutation.mutateAsync({ parent_id: null, body });
  };

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="comments-heading">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="comments-heading" className="inline-flex items-center gap-2 text-lg font-medium">
          <IconMessageCircle className="size-4 text-muted-foreground" />
          Comentarios{data ? ` (${data.data.length}${data.data.length === 50 ? "+" : ""})` : ""}
        </h2>

        <div className="inline-flex rounded-md border border-border/60 bg-card p-0.5 text-xs">
          {(["best", "recent", "old"] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                sort === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
              )}
            >
              {s === "best" ? "Mejores" : s === "recent" ? "Recientes" : "Antiguos"}
            </button>
          ))}
        </div>
      </div>

      <CommentForm onSubmit={handleCreate} placeholder="Comparte tu opinión…" busy={createMutation.isPending} />

      {isLoading && <div className="text-sm text-muted-foreground">Cargando comentarios…</div>}
      {error && (
        <div className="text-sm text-rose-600 dark:text-rose-400">
          No se pudieron cargar los comentarios. Intenta de nuevo más tarde.
        </div>
      )}

      <div className="space-y-3">
        {data?.data.map((root) => (
          <CommentThread key={root.id} productId={targetId} root={root} sort={sort} />
        ))}
        {data && data.data.length === 0 && !isLoading && (
          <div className="text-sm text-muted-foreground text-center py-6 italic">
            Aún no hay comentarios. ¡Sé el primero!
          </div>
        )}
      </div>

      {/* Show a load-more button when we hit the page size. */}
      {data && data.data.length >= 50 && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" disabled>
            Ver más (próximamente)
          </Button>
        </div>
      )}
    </section>
  );
}
