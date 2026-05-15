import { IconDots, IconPencil, IconTrash, IconUser } from "@tabler/icons-react";
import { useState } from "react";
import { useAuthStore } from "~/features/auth/store/auth";
import { CommentForm } from "~/features/comments/components/comment-form";
import { VoteButtons } from "~/features/comments/components/vote-buttons";
import type { CommentNode as CommentNodeT } from "~/features/comments/services/comments";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";
import { getImageUrl } from "~/shared/utils/images";

interface CommentNodeProps {
  node: Pick<
    CommentNodeT,
    | "id"
    | "author_id"
    | "author_username"
    | "author_avatar_url"
    | "body"
    | "score"
    | "deleted_at"
    | "deleted_reason"
    | "edited_at"
    | "created_at"
    | "depth"
  >;
  myVote: -1 | 0 | 1;
  onVote: (value: -1 | 0 | 1) => void;
  onReply: (body: string) => Promise<void> | void;
  onEdit: (body: string) => Promise<void> | void;
  onDelete: () => void;
  votePending?: boolean;
  /**
   * When true, hides the reply button (e.g. at the depth ceiling).
   */
  canReply?: boolean;
  children?: React.ReactNode;
}

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-CL");
};

export function CommentNode({
  node,
  myVote,
  onVote,
  onReply,
  onEdit,
  onDelete,
  votePending,
  canReply = true,
  children,
}: CommentNodeProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthor = !!user && user.id === node.author_id;
  const isDeleted = !!node.deleted_at;
  const isWithinEditWindow = isAuthor && !isDeleted && Date.now() - new Date(node.created_at).getTime() < 5 * 60 * 1000;

  const [showReply, setShowReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const displayName = isDeleted ? "[eliminado]" : node.author_username || (node.author_id ? "usuario" : "[anónimo]");

  return (
    <article className="flex gap-3 group">
      <div className="flex flex-col items-center shrink-0 pt-1">
        <VoteButtons score={node.score} myVote={myVote} pending={votePending} onVote={onVote} />
      </div>

      <div className="flex-1 min-w-0">
        <header className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="size-5 rounded-full overflow-hidden bg-secondary/40 flex items-center justify-center shrink-0">
            {node.author_avatar_url ? (
              <AsyncImage src={getImageUrl(node.author_avatar_url)} alt="" className="size-full object-cover" />
            ) : (
              <IconUser className="size-3 text-muted-foreground" />
            )}
          </div>
          <span className="font-medium text-foreground">{displayName}</span>
          <span>·</span>
          <time dateTime={node.created_at}>{formatRelative(node.created_at)}</time>
          {node.edited_at && !isDeleted && <span className="italic">(editado)</span>}
          {isDeleted && (
            <span className="italic">· eliminado{node.deleted_reason ? ` (${node.deleted_reason})` : ""}</span>
          )}
        </header>

        <div className="mt-1.5">
          {isEditing && !isDeleted ? (
            <CommentForm
              initialValue={node.body || ""}
              submitLabel="Guardar"
              autoFocus
              onCancel={() => setIsEditing(false)}
              onSubmit={async (body) => {
                await onEdit(body);
                setIsEditing(false);
              }}
            />
          ) : (
            <p
              className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap break-words",
                isDeleted ? "text-muted-foreground italic" : "text-foreground",
              )}
            >
              {isDeleted ? "[Comentario eliminado]" : node.body}
            </p>
          )}
        </div>

        {!isEditing && (
          <div className="mt-1.5 flex items-center gap-1 text-xs">
            {!isDeleted && canReply && (
              <Button variant="ghost" size="xs" onClick={() => setShowReply((v) => !v)} aria-expanded={showReply}>
                Responder
              </Button>
            )}
            {isWithinEditWindow && (
              <Button variant="ghost" size="xs" onClick={() => setIsEditing(true)}>
                <IconPencil className="size-3" />
                Editar
              </Button>
            )}
            {isAuthor && !isDeleted && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  if (window.confirm("¿Eliminar este comentario?")) onDelete();
                }}
              >
                <IconTrash className="size-3" />
                Eliminar
              </Button>
            )}
          </div>
        )}

        {showReply && !isDeleted && (
          <div className="mt-2">
            <CommentForm
              autoFocus
              placeholder="Responder…"
              submitLabel="Responder"
              onCancel={() => setShowReply(false)}
              onSubmit={async (body) => {
                await onReply(body);
                setShowReply(false);
              }}
            />
          </div>
        )}

        {children && <div className="mt-3 border-l-2 border-border/40 pl-3 space-y-3">{children}</div>}
      </div>

      {/* Ensures IconDots stays in the JSX for future menu UX; keeps imports clean. */}
      <IconDots className="hidden" aria-hidden="true" />
    </article>
  );
}
