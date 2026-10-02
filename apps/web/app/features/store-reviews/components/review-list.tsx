import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type ReviewSort,
  type StoreReviewItem,
  storeReviewKeys,
  useStoreReviewPages,
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
}

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "helpful", label: "Más útiles" },
  { value: "rating-desc", label: "Mejor calificadas" },
];

export function ReviewList({ storeSlug, canManage = false }: ReviewListProps) {
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<ReviewSort>("recent");
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useStoreReviewPages(
    storeSlug,
    sort,
  );

  const total = data?.pages[0]?.meta.total ?? 0;

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
              // Sin las páginas cargadas del orden que se deja, volver a él empieza otra vez por la primera.
              queryClient.removeQueries({ queryKey: storeReviewKeys.pages(storeSlug, sort) });
              setSort(value as ReviewSort);
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
        {data?.pages
          .flatMap((page) => page.data)
          .map((review: StoreReviewItem) => (
            <li key={review.id}>
              <ReviewCard storeSlug={storeSlug} review={review} canManage={canManage} />
            </li>
          ))}
      </ul>

      {hasNextPage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-center"
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {isFetchingNextPage ? "Cargando…" : "Cargar más"}
        </Button>
      )}
    </div>
  );
}
