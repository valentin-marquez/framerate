import { Skeleton } from "~/shared/components/primitives/skeleton";
import { cn } from "~/shared/lib/utils";

interface ProductCardSkeletonProps {
  className?: string;
}

export function ProductCardSkeleton({ className }: ProductCardSkeletonProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl h-105 md:h-100",
        "bg-card/70 border border-border",
        className,
      )}
    >
      {/* Image placeholder */}
      <Skeleton className="w-full h-48 sm:h-56 md:h-60 rounded-none" />

      <div className="flex flex-col gap-2 p-4 pb-2">
        {/* Brand + views row */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>

        {/* Title (2 lines) */}
        <div className="space-y-1.5 min-h-[2.5em]">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>

        {/* Specs tags */}
        <div className="flex gap-1 mt-1">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>

        {/* Price row */}
        <div className="mt-auto pt-3 border-t border-border/50">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
