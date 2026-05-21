import { useState } from "react";
import {
  type ReviewSort,
  type StoreReviewItem,
  useStoreReviews,
} from "~/features/store-reviews/services/store-reviews";
import { Button } from "~/shared/components/primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/shared/components/primitives/select";
import { Skeleton } from "~/shared/components/primitives/skeleton";
import { ReviewCard } from "./review-card";

interface ReviewListProps {
  storeSlug: string;
  /**
   * Si el viewer es store member (editor/owner) o admin, permite responder/pinear.
   */
  canManage?: boolean;
  /**
   * IDs de reviews que el viewer ya marcó como útil (lo decide el padre).
   */
  helpfulReviewIds?: Set<string>;
}

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "helpful", label: "Más útiles" },
  { value: "rating-desc", label: "Mejor calificadas" },
];

export function ReviewList({ storeSlug, canManage = false, helpfulReviewIds }: ReviewListProps) {
  const [sort, setSort] = useState<ReviewSort>("recent");
  const [page, setPage] = useState(0);

  const offset = page * PAGE_SIZE;
  const { data, isLoading, isError } = useStoreReviews(storeSlug, sort, PAGE_SIZE, offset);

  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // El estado vacío lo cubre RatingSummary con un placeholder visual; aquí
  // dejaríamos un mensaje redundante ("Aún no hay reseñas...").
  if (!isLoading && !isError && total === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Reseñas {total > 0 && <span className="text-muted-foreground">({total})</span>}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Ordenar:</span>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as ReviewSort);
              setPage(0);
            }}
          >
            <SelectTrigger size="sm" aria-label="Ordenar reseñas">
              <SelectValue>
                {(value: string) => SORT_OPTIONS.find((o) => o.value === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {isError && <p className="text-sm text-destructive">No se pudieron cargar las reseñas.</p>}

      <ul className="flex flex-col gap-3">
        {data?.data.map((review: StoreReviewItem) => (
          <li key={review.id}>
            <ReviewCard
              storeSlug={storeSlug}
              review={review}
              canManage={canManage}
              hasMarkedHelpful={helpfulReviewIds?.has(review.id) ?? false}
            />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
