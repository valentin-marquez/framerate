import { IconPhotoOff, IconTrendingUp } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import type { Product } from "~/features/product/services/products";
import { productsService } from "~/features/product/services/products";
import { getProductPricing } from "~/features/product/utils/pricing";
import { getSpecsSummary } from "~/features/product/utils/specs";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Skeleton } from "~/shared/components/primitives/skeleton";
import { productKeys } from "~/shared/lib/query-keys";
import { cn } from "~/shared/lib/utils";
import type { PsuSpecs } from "~/shared/utils/db-types";
import { formatCLP } from "~/shared/utils/format";
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
 * Panel derecho de la tarjeta: la foto es el fondo y se funde hacia la izquierda con un velo suavizado (la capa tiene
 * el tono de la foto: blanco, o gris claro en oscuro vía `--product-stage` + multiply, así nunca se ve su borde).
 * Mientras carga sólo se ve el color de la tarjeta y un orbe; al llegar la foto, el panel se abre desde el orbe.
 */
function ProductStage({ product, priority, psu }: { product: Product; priority: boolean; psu: string | null }) {
  const [stage, setStage] = useState<"loading" | "opening" | "open">("loading");

  if (!product.image_url) {
    return (
      <div className="absolute inset-y-0 right-0 flex w-[58%] items-center justify-end pr-8 text-foreground/20">
        <IconPhotoOff className="size-8" stroke={1.25} role="img" aria-label="Sin imagen" />
        {psu && (
          <div className="absolute top-2 right-2">
            <PsuBadge certification={psu} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-y-0 right-0 isolate w-[58%] overflow-hidden"
      // El producto va alineado a la derecha: el orbe y la apertura nacen ahí, no en el centro del panel.
      style={{ "--reveal-x": "68%" } as React.CSSProperties}
    >
      <div
        aria-hidden
        className="stage-backdrop absolute inset-0 bg-[var(--product-stage)]"
        data-state={stage === "opening" ? "open" : undefined}
      />
      <AsyncImage
        src={product.image_url}
        alt={product.name ?? "Producto"}
        priority={priority}
        reveal="none"
        onReady={(fromCache) => setStage(fromCache ? "open" : "opening")}
        data-state={stage === "opening" ? "open" : undefined}
        className="stage-image size-full object-contain object-right p-3 pl-0 mix-blend-multiply"
      />
      <div aria-hidden className="scrim-card-to-r absolute inset-y-0 left-0 w-3/5" />
      {/* En oscuro el panel es más claro que el pie: se funde también hacia abajo para no cortar en seco. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 hidden h-2/5 bg-gradient-to-t from-card to-transparent dark:block"
      />
      {stage !== "open" && (
        <>
          <div
            aria-hidden
            className="stage-cover"
            data-state={stage === "opening" ? "open" : "closed"}
            onAnimationEnd={() => setStage("open")}
          />
          <span aria-hidden className="image-orb" data-state={stage === "opening" ? "splash" : "loading"}>
            <span />
          </span>
        </>
      )}
      {psu && (
        <div className="absolute top-2 right-2">
          <PsuBadge certification={psu} />
        </div>
      )}
    </div>
  );
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
        "group @container relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-foreground/15",
        className,
      )}
    >
      <div className="relative flex min-h-36">
        <ProductStage product={product} priority={priority} psu={psu} />

        <div className="relative flex w-[58%] min-w-0 flex-col gap-1.5 p-3 pt-3.5 pb-2.5">
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
