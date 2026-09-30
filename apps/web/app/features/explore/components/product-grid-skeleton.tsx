import { ProductCardSkeleton } from "~/features/product/components/product-card";

export const PRODUCT_GRID_CLASS = "grid gap-3 md:grid-cols-2 xl:grid-cols-3";

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => {
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático sin reordenamiento
        return <ProductCardSkeleton key={`skeleton-${i}`} />;
      })}
    </div>
  );
}
