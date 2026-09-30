import type { PsuSpecs } from "@framerate/db";
import { IconPhotoOff, IconTrendingUp } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import type { Product } from "~/features/product/services/products";
import { productsService } from "~/features/product/services/products";
import { getProductPricing } from "~/features/product/utils/pricing";
import { getSpecsSummary } from "~/features/product/utils/specs";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Skeleton } from "~/shared/components/primitives/skeleton";
import { productKeys } from "~/shared/lib/query-keys";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getImageUrl } from "~/shared/utils/images";
import { AddToQuote } from "./add-to-quote";
import { PsuBadge } from "./psu-badge";

interface ProductCardProps {
  product: Product;
  /** La foto carga con prioridad (primeras tarjetas visibles, LCP). */
  priority?: boolean;
  /** En el ranking de tendencia (server-side). */
  trending?: boolean;
  className?: string;
}

function availabilityText(inStock: boolean, stores: number) {
  if (!inStock) return "Sin stock";
  if (stores > 1) return `En ${stores} tiendas`;
  return stores === 1 ? "En 1 tienda" : "Disponible";
}

/**
 * Tarjeta de producto, la misma en catálogo, home y tiendas. Horizontal: el texto manda (marca, nombre, specs,
 * precio y disponibilidad) y la foto es una miniatura a la derecha con el botón de cotizar encima.
 */
export function ProductCard({ product, priority = false, trending = false, className }: ProductCardProps) {
  const queryClient = useQueryClient();
  const { current, card, hasCardGap, hasRealDrop, reference, dropPct } = getProductPricing(product.prices);
  const specs = getSpecsSummary(product);
  const inStock = product.prices?.in_stock !== false;
  const psu =
    product.category?.slug === "fuentes-de-poder"
      ? ((product.specs as PsuSpecs | null)?.efficiency_rating ?? null)
      : null;

  const prefetch = () => {
    const slug = product.slug;
    if (!slug) return;
    queryClient.prefetchQuery({
      queryKey: productKeys.detail(slug),
      queryFn: () => productsService.getBySlug(slug),
      staleTime: 60_000,
    });
  };

  return (
    <article
      className={cn(
        "group @container relative flex h-full gap-4 rounded-3xl border border-border bg-card p-3 transition-colors hover:border-foreground/15",
        className,
      )}
    >
      <Link
        to={`/producto/${product.slug}`}
        onClick={() => product.slug && productsService.trackView(product.slug).catch(() => {})}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        className="flex min-w-0 flex-1 gap-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
          <div className="flex min-h-5 items-center gap-2">
            {product.brand?.name && (
              <span className="truncate text-muted-foreground text-xs">{product.brand.name}</span>
            )}
            {trending && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 font-medium text-[11px] text-foreground">
                <IconTrendingUp className="size-3" stroke={2} />
                Tendencia
              </span>
            )}
          </div>

          <h3 className="line-clamp-2 font-medium text-foreground text-sm leading-snug">{product.name}</h3>

          {specs.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {specs.map((s) => (
                <li key={s} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {s}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1.5">
            {current ? (
              <span className="font-semibold text-foreground tabular-nums">{formatCLP(current)}</span>
            ) : (
              <span className="text-muted-foreground text-sm">Ver tiendas</span>
            )}
            {hasRealDrop && reference && (
              <>
                <span className="hidden text-muted-foreground text-xs tabular-nums line-through @[18rem]:inline">
                  {formatCLP(reference)}
                </span>
                <span className="font-semibold text-success text-xs">−{dropPct}%</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                inStock ? "text-muted-foreground" : "text-foreground/40",
              )}
            >
              <span aria-hidden className={cn("size-1.5 rounded-full", inStock ? "bg-success" : "bg-foreground/25")} />
              {availabilityText(inStock, product.listings_count ?? 0)}
            </span>
            {hasCardGap && card && (
              <span className="text-muted-foreground tabular-nums">Con tarjeta {formatCLP(card)}</span>
            )}
          </div>
        </div>

        <div className="relative size-24 shrink-0 self-center overflow-hidden rounded-2xl bg-white sm:size-28">
          <div className="absolute inset-0 p-2">
            {product.image_url ? (
              <AsyncImage
                src={getImageUrl(product.image_url)}
                alt={product.name ?? "Producto"}
                priority={priority}
                className="size-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.05]"
              />
            ) : (
              <div
                className="flex size-full items-center justify-center text-foreground/20"
                role="img"
                aria-label="Sin imagen"
              >
                <IconPhotoOff className="size-7" stroke={1.25} />
              </div>
            )}
          </div>
          {psu && (
            <div className="absolute top-1.5 left-1.5">
              <PsuBadge certification={psu} />
            </div>
          )}
        </div>
      </Link>

      <AddToQuote product={product} className="absolute right-4 bottom-4 size-8 bg-card/90 backdrop-blur-md" />
    </article>
  );
}

/** Mismo contorno que la tarjeta, para cargas. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-4 rounded-3xl border border-border bg-card p-3", className)}>
      <div className="flex flex-1 flex-col gap-2 py-0.5">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <div className="flex gap-1">
          <Skeleton className="h-4 w-14 rounded-md" />
          <Skeleton className="h-4 w-10 rounded-md" />
        </div>
        <Skeleton className="mt-auto h-4 w-24" />
      </div>
      <Skeleton className="size-24 shrink-0 self-center rounded-2xl sm:size-28" />
    </div>
  );
}
