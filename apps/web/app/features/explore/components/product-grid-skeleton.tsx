import { ProductCardSkeleton } from "~/features/product/components/card-product-skeleton";

interface ProductGridSkeletonProps {
  count?: number;
}

export function ProductGridSkeleton({ count = 12 }: ProductGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => {
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático sin reordenamiento
        return <ProductCardSkeleton key={`skeleton-${i}`} />;
      })}
    </div>
  );
}
