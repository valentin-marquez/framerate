import { useMemo, useState } from "react";
import { useAuthStore } from "~/features/auth/store/auth";
import {
  type StoreReview,
  type StoreReviewItem,
  useStoreReviews,
} from "~/features/store-reviews/services/store-reviews";
import { Button } from "~/shared/components/primitives/button";
import { RatingSummary } from "./rating-summary";
import { ReviewForm } from "./review-form";
import { ReviewList } from "./review-list";

interface StoreReviewsSectionProps {
  storeSlug: string;
  /**
   * Si el viewer puede gestionar la tienda (owner/editor/admin), pasar true.
   * Fase 1 lo resuelve desde `is_store_member`/`authorize`. Default: false.
   */
  canManage?: boolean;
}

/**
 * Sección completa de reseñas para una tienda. Diseñada para incrustarse en la
 * página de detalle de tienda de Fase 1. Punto de entrada exportable.
 */
export function StoreReviewsSection({ storeSlug, canManage = false }: StoreReviewsSectionProps) {
  const user = useAuthStore((s) => s.user);
  const [editingMyReview, setEditingMyReview] = useState(false);

  // Recuperamos la primera página para detectar si el viewer ya tiene una review activa.
  const { data: firstPage } = useStoreReviews(storeSlug, "recent", 50, 0);

  const myReview: StoreReview | null = useMemo(() => {
    if (!user || !firstPage) return null;
    const candidate = firstPage.data.find((r: StoreReviewItem): r is StoreReview => {
      return r.deleted === false && r.user_id === user.id;
    });
    return candidate ?? null;
  }, [firstPage, user]);

  return (
    <section className="flex flex-col gap-6" aria-label="Reseñas de la tienda">
      <RatingSummary storeSlug={storeSlug} />

      {user && (
        <div>
          {myReview && !editingMyReview ? (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/30 p-4">
              <div>
                <p className="font-medium text-sm">Ya publicaste una reseña</p>
                <p className="text-xs text-muted-foreground">Puedes editarla o eliminarla desde la lista.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingMyReview(true)}>
                Editar
              </Button>
            </div>
          ) : (
            <ReviewForm
              storeSlug={storeSlug}
              existing={editingMyReview ? myReview : null}
              onDone={() => setEditingMyReview(false)}
            />
          )}
        </div>
      )}

      <ReviewList storeSlug={storeSlug} canManage={canManage} />
    </section>
  );
}
