import type { Comment } from "@framerate/contracts";
import { IconArrowBackUp, IconHeart, IconHeartFilled, IconPencil, IconTrash, IconUser } from "@tabler/icons-react";
import { useState } from "react";
import { useUser } from "~/features/auth/hooks/useAuth";
import { CommentBody } from "~/features/comments/components/comment-body";
import { CommentForm } from "~/features/comments/components/comment-form";
import { ReportButton } from "~/features/moderation";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { cn } from "~/shared/lib/utils";

interface CommentNodeProps {
  node: Comment;
  onLike: () => void;
  onReply: (body: string) => Promise<void> | void;
  onEdit: (body: string) => Promise<void> | void;
  onDelete: () => void;
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

export function CommentNode({ node, onLike, onReply, onEdit, onDelete, canReply = true, children }: CommentNodeProps) {
  const user = useUser();
  const isAuthor = !!user && user.username === node.author?.username;
  const isDeleted = !!node.deletedAt;

  const [showReply, setShowReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isAuthed = !!user;
  const liked = node.likedByMe;
  const displayName = isDeleted ? "[eliminado]" : (node.author?.username ?? "[anónimo]");

  const handleLike = () => {
    if (!isAuthed || isDeleted) return;
    onLike();
  };

  return (
    <article className="flex gap-3 group" data-comment-id={node.id}>
      <div className="size-8 rounded-full overflow-hidden bg-secondary/40 flex items-center justify-center shrink-0">
        {node.author?.avatarUrl ? (
          <AsyncImage src={node.author.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <IconUser className="size-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-foreground text-sm leading-none">{displayName}</span>
          {isDeleted && (
            <span className="text-xs italic text-muted-foreground">
              {node.deletionReason === "moderation" ? "eliminado por moderación" : "eliminado"}
            </span>
          )}
          {node.editedAt && !isDeleted && <span className="text-xs italic text-muted-foreground">(editado)</span>}
        </div>

        <div className="mt-1">
          {isEditing && !isDeleted ? (
            <CommentForm
              initialValue={node.body || ""}
              submitLabel="Guardar cambios"
              onCancel={() => setIsEditing(false)}
              onSubmit={async (body) => {
                await onEdit(body);
                setIsEditing(false);
              }}
            />
          ) : isDeleted ? (
            <p className="text-sm leading-relaxed italic text-muted-foreground">[Comentario eliminado]</p>
          ) : (
            <CommentBody body={node.body || ""} />
          )}
        </div>

        {!isEditing && (
          <div className="mt-1.5 flex items-center gap-3.5 text-xs text-muted-foreground/90">
            <FooterAction
              onClick={handleLike}
              disabled={!isAuthed || isDeleted}
              pressed={liked}
              aria-label={liked ? "Quitar me gusta" : "Me gusta"}
              className={cn(
                "hover:text-rose-600 dark:hover:text-rose-400",
                liked && "text-rose-600 dark:text-rose-400",
              )}
            >
              {liked ? <IconHeartFilled className="size-4" /> : <IconHeart className="size-4" />}
              <span className="tabular-nums">{node.likeCount}</span>
            </FooterAction>

            {!isDeleted && canReply && (
              <FooterAction onClick={() => setShowReply((v) => !v)} aria-expanded={showReply}>
                <IconArrowBackUp className="size-3.5" />
                Responder
              </FooterAction>
            )}

            <time dateTime={node.createdAt} className="select-none">
              {formatRelative(node.createdAt)}
            </time>

            {isAuthor && !isDeleted && (
              <FooterAction onClick={() => setIsEditing(true)}>
                <IconPencil className="size-3.5" />
                Editar
              </FooterAction>
            )}
            {isAuthor && !isDeleted && (
              <FooterAction
                onClick={() => {
                  if (window.confirm("¿Eliminar este comentario?")) onDelete();
                }}
                className="hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
              >
                <IconTrash className="size-3.5" />
                Eliminar
              </FooterAction>
            )}
            {!isAuthor && !isDeleted && user && (
              <ReportButton
                targetType="comment"
                targetId={String(node.id)}
                contextLabel={`Comentario de ${displayName}`}
                size="xs"
              />
            )}
          </div>
        )}

        {showReply && !isDeleted && (
          <div className="mt-2 animate-in fade-in-0 slide-in-from-top-1 duration-base ease-out">
            <CommentForm
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

        {children && <div className="mt-3 border-l border-border/40 pl-4 space-y-4">{children}</div>}
      </div>
    </article>
  );
}

interface FooterActionProps {
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
}

function FooterAction({
  onClick,
  disabled,
  pressed,
  className,
  children,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
}: FooterActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1 -mx-1 py-0.5 transition-colors",
        "hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-ring/50 focus-visible:outline-offset-2",
        disabled && "opacity-50 cursor-not-allowed hover:text-muted-foreground/90",
        className,
      )}
    >
      {children}
    </button>
  );
}
