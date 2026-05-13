import { Skeleton } from "~/shared/components/primitives/skeleton";

export function PriceDropsSkeleton() {
  return (
    <section className="container mx-auto px-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      {/* Carousel cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático sin reordenamiento
            <div key={`drop-skeleton-${i}`} className="rounded-xl border border-border bg-card/70 overflow-hidden">
              <Skeleton className="w-full h-48 rounded-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
