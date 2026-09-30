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
        "group @container relative flex h-full flex-col rounded-3xl border border-border bg-card transition-colors hover:border-foreground/15",
        className,
      )}
    >
      <div className="flex gap-3 p-3 pb-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
          <div className="flex h-5 items-center gap-2">
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

          {/* Siempre ocupa dos líneas: así todas las tarjetas miden lo mismo y el pie no queda flotando. */}
          <h3 className="line-clamp-2 min-h-[2.75em] font-medium text-foreground text-sm leading-snug">
            {/* El enlace cubre toda la tarjeta (::after); el botón de cotizar queda por encima. */}
            <Link
              to={`/producto/${product.slug}`}
              onClick={() => product.slug && productsService.trackView(product.slug).catch(() => {})}
              onMouseEnter={prefetch}
              onFocus={prefetch}
              className="after:absolute after:inset-0 after:z-[1] after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {product.name}
            </Link>
          </h3>

          {specs.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {specs.map((s) => (
                <li key={s} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* La foto se funde con la tarjeta en vez de ir en un recuadro: se multiplica sobre un halo que va de
            `--product-stage` al color de la tarjeta, así el fondo blanco de las fotos de tienda toma el color del halo
            y se desvanece sin bordes (en oscuro queda como un foco suave detrás del producto). */}
        <div className="relative size-24 shrink-0 sm:size-28">
          <div
            className={cn(
              "absolute inset-0 isolate p-2",
              product.image_url && "bg-[radial-gradient(circle_closest-side,var(--product-stage)_55%,var(--card))]",
            )}
          >
            {product.image_url ? (
              <AsyncImage
                src={getImageUrl(product.image_url)}
                alt={product.name ?? "Producto"}
                priority={priority}
                className="size-full object-contain mix-blend-multiply"
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
            <div className="absolute top-0 left-0">
              <PsuBadge certification={psu} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-border border-t px-3 py-2.5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {current ? (
              <span className="font-semibold text-foreground tabular-nums">{formatCLP(current)}</span>
            ) : (
              <span className="text-muted-foreground text-sm">Ver tiendas</span>
            )}
            {hasRealDrop && reference && (
              <>
                <span className="hidden text-muted-foreground text-xs tabular-nums line-through @[20rem]:inline">
                  {formatCLP(reference)}
                </span>
                <span className="font-semibold text-success text-xs">−{dropPct}%</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 text-xs">
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
              <span className="hidden text-muted-foreground tabular-nums @[20rem]:inline">
                Con tarjeta {formatCLP(card)}
              </span>
            )}
          </div>
        </div>
        <AddToQuote product={product} label="short" className="relative z-10 shrink-0" />
      </div>
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
