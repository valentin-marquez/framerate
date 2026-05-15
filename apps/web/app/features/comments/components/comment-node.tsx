import { IconArrowBackUp, IconHeart, IconHeartFilled, IconPencil, IconTrash, IconUser } from "@tabler/icons-react";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { useState } from "react";
import { useAuthStore } from "~/features/auth/store/auth";
import { CommentBody } from "~/features/comments/components/comment-body";
import { CommentForm } from "~/features/comments/components/comment-form";
import type { CommentNode as CommentNodeT } from "~/features/comments/services/comments";
import { ReportButton } from "~/features/moderation";
import { AsyncImage } from "~/shared/components/primitives/async-image";
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

  const isAuthed = !!user;
  const liked = myVote === 1;
  const displayName = isDeleted ? "[eliminado]" : node.author_username || (node.author_id ? "usuario" : "[anónimo]");

  const handleLike = () => {
    if (!isAuthed || votePending || isDeleted) return;
    onVote(liked ? 0 : 1);
  };

  return (
    <LazyMotion features={domAnimation}>
      <article className="flex gap-3 group" data-comment-id={node.id}>
        <div className="size-8 rounded-full overflow-hidden bg-secondary/40 flex items-center justify-center shrink-0">
          {node.author_avatar_url ? (
            <AsyncImage src={getImageUrl(node.author_avatar_url)} alt="" className="size-full object-cover" />
          ) : (
            <IconUser className="size-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-foreground text-sm leading-none">{displayName}</span>
            {isDeleted && (
              <span className="text-xs italic text-muted-foreground">
                · eliminado{node.deleted_reason ? ` (${node.deleted_reason})` : ""}
              </span>
            )}
            {node.edited_at && !isDeleted && <span className="text-xs italic text-muted-foreground">(editado)</span>}
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
                disabled={!isAuthed || votePending || isDeleted}
                pressed={liked}
                aria-label={liked ? "Quitar me gusta" : "Me gusta"}
                className={cn(
                  "hover:text-rose-600 dark:hover:text-rose-400",
                  liked && "text-rose-600 dark:text-rose-400",
                )}
              >
                {liked ? <IconHeartFilled className="size-4" /> : <IconHeart className="size-4" />}
                <span className="tabular-nums">{Math.max(0, node.score)}</span>
              </FooterAction>

              {!isDeleted && canReply && (
                <FooterAction onClick={() => setShowReply((v) => !v)} aria-expanded={showReply}>
                  <IconArrowBackUp className="size-3.5" />
                  Responder
                </FooterAction>
              )}

              <time dateTime={node.created_at} className="select-none">
                {formatRelative(node.created_at)}
              </time>

              {isWithinEditWindow && (
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
                  className="hover:text-rose-600 dark:hover:text-rose-400"
                >
                  <IconTrash className="size-3.5" />
                  Eliminar
                </FooterAction>
              )}
              {!isAuthor && !isDeleted && user && (
                <ReportButton
                  targetType="comment"
                  targetId={node.id}
                  contextLabel={`Comentario de ${displayName}`}
                  size="xs"
                />
              )}
            </div>
          )}

          <AnimatePresence initial={false}>
            {showReply && !isDeleted && (
              <m.div
                key="reply-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-2">
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
              </m.div>
            )}
          </AnimatePresence>

          {children && <div className="mt-3 border-l border-border/40 pl-4 space-y-4">{children}</div>}
        </div>
      </article>
    </LazyMotion>
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
