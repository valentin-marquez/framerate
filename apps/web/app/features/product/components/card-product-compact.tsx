import { IconTrendingUp } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import type { Product } from "~/features/product/services/products";
import { productsService } from "~/features/product/services/products";
import { getProductPricing } from "~/features/product/utils/pricing";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Badge } from "~/shared/components/primitives/badge";
import { productKeys } from "~/shared/lib/query-keys";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getImageUrl } from "~/shared/utils/images";

interface ProductCardCompactProps {
  product: Product;
  className?: string;
  priority?: boolean;
  /** Marca el producto como "Tendencia" (ranking server-side). */
  trending?: boolean;
}

/**
 * Card compacta para los carruseles temáticos de la home (estilo Airbnb).
 * Densa y de baja altura: imagen + nombre + precio. La card alta con specs
 * y AddToQuote (`ProductCard`) se mantiene para /explorar.
 */
export function ProductCardCompact({
  product,
  className,
  priority = false,
  trending = false,
}: ProductCardCompactProps) {
  const queryClient = useQueryClient();

  const { current: currentPrice, hasRealDrop, reference, dropPct } = getProductPricing(product.prices);

  const handleProductClick = () => {
    if (product.slug) {
      productsService.trackView(product.slug).catch((err: unknown) => console.error("Failed to track view", err));
    }
  };

  const handlePrefetch = () => {
    const slug = product.slug;
    if (slug) {
      queryClient.prefetchQuery({
        queryKey: productKeys.detail(slug),
        queryFn: () => productsService.getBySlug(slug),
        staleTime: 60_000,
      });
    }
  };

  return (
    <Link
      to={`/producto/${product.slug}`}
      onClick={handleProductClick}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      aria-label={`Ver detalles de ${product.name}`}
      className={cn(
        "group/card flex flex-col overflow-hidden rounded-2xl",
        "border border-border/40 bg-card/70",
        "hover:border-primary/30 hover:bg-card transition-all duration-300",
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/20">
        {product.image_url ? (
          <AsyncImage
            src={getImageUrl(product.image_url)}
            alt={product.name || "Imagen del producto"}
            className="size-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="text-muted-foreground text-xs">Sin imagen</span>
          </div>
        )}

        {hasRealDrop && (
          <Badge className="absolute top-2.5 right-2.5 rounded-full bg-primary/90 px-2 py-0.5 text-[11px] font-semibold">
            -{dropPct}%
          </Badge>
        )}

        {trending && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-card/85 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-primary">
            <IconTrendingUp className="size-3" />
            Tendencia
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand?.name && (
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide line-clamp-1">
            {product.brand.name}
          </span>
        )}

        <h3 className="line-clamp-2 text-sm font-medium tracking-tight text-foreground group-hover/card:text-primary transition-colors duration-200 min-h-[2.5em]">
          {product.name}
        </h3>

        <div className="mt-auto flex items-baseline gap-1.5 pt-1.5">
          {currentPrice ? (
            <>
              <span className="text-sm font-semibold text-foreground tabular-nums">{formatCLP(currentPrice)}</span>
              {hasRealDrop && reference && (
                <span className="text-xs text-muted-foreground line-through decoration-muted-foreground tabular-nums">
                  {formatCLP(reference)}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Ver tiendas</span>
          )}
        </div>
      </div>
    </Link>
  );
}
