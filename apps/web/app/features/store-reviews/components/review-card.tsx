import {
  IconDots,
  IconPinFilled,
  IconShieldCheck,
  IconThumbUp,
  IconThumbUpFilled,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { useAuthStore } from "~/features/auth/store/auth";
import { ReportButton } from "~/features/moderation";
import {
  type StoreReview,
  type StoreReviewItem,
  useDeleteStoreReview,
  useMarkReviewHelpful,
  usePinReview,
} from "~/features/store-reviews/services/store-reviews";
import { Badge } from "~/shared/components/primitives/badge";
import { Button } from "~/shared/components/primitives/button";
import { Card, CardContent } from "~/shared/components/primitives/card";
import { cn } from "~/shared/lib/utils";
import { OwnerResponseForm } from "./owner-response-form";
import { RatingStars } from "./rating-stars";

interface ReviewCardProps {
  storeSlug: string;
  review: StoreReviewItem;
  /**
   * Si true, el usuario actual es store owner/editor o admin y puede responder/pinear.
   */
  canManage?: boolean;
  /**
   * Si true, el usuario actual ya marcó esta review como útil (lo decide el padre).
   */
  hasMarkedHelpful?: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ReviewCard({ storeSlug, review, canManage = false, hasMarkedHelpful = false }: ReviewCardProps) {
  const user = useAuthStore((s) => s.user);
  const [showResponseForm, setShowResponseForm] = useState(false);

  const helpfulMut = useMarkReviewHelpful(storeSlug);
  const pinMut = usePinReview(storeSlug);
  const deleteMut = useDeleteStoreReview(storeSlug);

  if (review.deleted) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm italic text-muted-foreground">
            Esta reseña fue eliminada{review.deleted_reason ? ` (${review.deleted_reason})` : ""}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const full = review as StoreReview;
  const isAuthor = user?.id === full.user_id;
  const authorName = full.author?.username || full.author?.full_name || "Usuario";

  async function handleHelpful() {
    if (!user) return;
    await helpfulMut.mutateAsync({ id: full.id, helpful: !hasMarkedHelpful });
  }

  async function handlePin() {
    await pinMut.mutateAsync(full.id);
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta reseña? Esta acción no se puede deshacer.")) return;
    await deleteMut.mutateAsync({ id: full.id });
  }

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {full.author?.avatar_url ? (
                <img
                  src={full.author.avatar_url}
                  alt={authorName}
                  className="size-10 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{authorName}</span>
                  {/* TODO: slot "verified purchase" */}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RatingStars value={full.rating} size="sm" />
                  <span>·</span>
                  <span>{formatDate(full.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {full.is_pinned && (
                <Badge variant="outline" className="gap-1">
                  <IconPinFilled className="size-3" />
                  <span>Destacada</span>
                </Badge>
              )}
              <div className="flex items-center gap-1">
                {!isAuthor && user && (
                  <ReportButton
                    targetType="store_review"
                    targetId={full.id}
                    contextLabel={`Reseña de ${authorName}`}
                    iconOnly
                  />
                )}
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handlePin}
                    aria-label={full.is_pinned ? "Quitar destacado" : "Destacar reseña"}
                    title={full.is_pinned ? "Quitar destacado" : "Destacar reseña"}
                  >
                    <IconPinFilled className={cn("size-4", full.is_pinned && "text-primary")} />
                  </Button>
                )}
                {(isAuthor || canManage) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleDelete}
                    aria-label="Eliminar reseña"
                    title="Eliminar"
                  >
                    <IconTrash className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Comment */}
          {full.comment && <p className="whitespace-pre-wrap text-sm leading-relaxed">{full.comment}</p>}

          {/* Footer: helpful + acciones */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleHelpful}
              disabled={!user || helpfulMut.isPending}
              className="gap-1.5"
            >
              {hasMarkedHelpful ? <IconThumbUpFilled className="size-4" /> : <IconThumbUp className="size-4" />}
              <span>Útil ({full.helpful_count})</span>
            </Button>
            {canManage && !full.owner_response && !showResponseForm && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowResponseForm(true)}>
                Responder
              </Button>
            )}
          </div>

          {/* Owner response */}
          {full.owner_response && !showResponseForm && (
            <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <IconShieldCheck className="size-4" />
                <span>Respuesta de la tienda</span>
                {full.owner_response_at && (
                  <span className="text-muted-foreground">· {formatDate(full.owner_response_at)}</span>
                )}
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowResponseForm(true)}
                    className="ml-auto"
                    aria-label="Editar respuesta"
                  >
                    <IconDots className="size-3" />
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{full.owner_response}</p>
            </div>
          )}

          {/* Response form */}
          {showResponseForm && (
            <OwnerResponseForm storeSlug={storeSlug} review={full} onDone={() => setShowResponseForm(false)} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
