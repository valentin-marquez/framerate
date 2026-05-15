import { useStoreRatingStats } from "~/features/store-reviews/services/store-reviews";
import { Card, CardContent } from "~/shared/components/primitives/card";
import { Skeleton } from "~/shared/components/primitives/skeleton";
import { RatingStars } from "./rating-stars";

interface RatingSummaryProps {
  storeSlug: string;
}

/**
 * Resumen agregado de ratings: avg, total y distribución por estrella.
 */
export function RatingSummary({ storeSlug }: RatingSummaryProps) {
  const { data, isLoading } = useStoreRatingStats(storeSlug);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total_reviews === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aún no hay reseñas para esta tienda.</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.total_reviews;
  const avg = data.avg_rating ?? 0;

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-1 sm:min-w-[120px]">
            <span className="text-4xl font-semibold tabular-nums">{Number(avg).toFixed(1)}</span>
            <RatingStars value={avg} size="md" />
            <span className="text-xs text-muted-foreground">
              {total} reseña{total === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex-1">
            <div className="flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const key = String(star) as "1" | "2" | "3" | "4" | "5";
                const count = data.distribution?.[key] ?? 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-3 tabular-nums text-muted-foreground">{star}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-amber-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
