import type { PsuSpecs } from "@framerate/db";
import { IconPhotoOff, IconTrendingUp } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import type { Product } from "~/features/product/services/products";
import { productsService } from "~/features/product/services/products";
import { getProductPricing } from "~/features/product/utils/pricing";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { productKeys } from "~/shared/lib/query-keys";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getImageUrl } from "~/shared/utils/images";
import { AddToQuote } from "./add-to-quote";
import { getSpecsSummary } from "./card-product";
import { PsuBadge } from "./psu-badge";

/**
 * Tres propuestas de tarjeta única de producto (reemplazarían a ProductCard y ProductCardCompact).
 * Comparten datos y comportamiento; cambia la composición. Se revisan en Storybook ("Producto/Tarjeta unificada").
 */

export interface ProductCardOptionProps {
  product: Product;
  priority?: boolean;
  trending?: boolean;
  className?: string;
}

function useCardData(product: Product) {
  const queryClient = useQueryClient();
  const pricing = getProductPricing(product.prices);
  const specs = getSpecsSummary(product).slice(0, 3);
  const inStock = product.prices?.in_stock !== false;
  const stores = product.listings_count ?? 0;
  const psu =
    product.category?.slug === "fuentes-de-poder"
      ? ((product.specs as PsuSpecs | null)?.efficiency_rating ?? null)
      : null;

  const link = {
    to: `/producto/${product.slug}`,
    prefetch: "none" as const,
    onClick: () => {
      if (product.slug) productsService.trackView(product.slug).catch(() => {});
    },
    onMouseEnter: () => {
      const slug = product.slug;
      if (slug) {
        queryClient.prefetchQuery({
          queryKey: productKeys.detail(slug),
          queryFn: () => productsService.getBySlug(slug),
          staleTime: 60_000,
        });
      }
    },
  };

  const availability = !inStock
    ? "Sin stock"
    : stores > 1
      ? `En ${stores} tiendas`
      : stores === 1
        ? "En 1 tienda"
        : "Disponible";

  return { ...pricing, specs, inStock, stores, psu, link, availability };
}

function ProductImage({ product, priority, className }: { product: Product; priority?: boolean; className?: string }) {
  if (!product.image_url) {
    return (
      <div className="flex size-full items-center justify-center text-foreground/20" role="img" aria-label="Sin imagen">
        <IconPhotoOff className="size-8" stroke={1.25} />
      </div>
    );
  }
  return (
    <AsyncImage
      src={getImageUrl(product.image_url)}
      alt={product.name ?? "Producto"}
      priority={priority}
      className={cn(
        // Las fotos de tienda traen fondo blanco: `multiply` lo funde con el panel claro.
        "size-full object-contain mix-blend-multiply transition-transform duration-500 ease-out group-hover:scale-[1.04]",
        className,
      )}
    />
  );
}

const Price = ({
  value,
  reference,
  className,
}: {
  value: number | null;
  reference?: number | null;
  className?: string;
}) =>
  value ? (
    <p className={cn("flex items-baseline gap-2", className)}>
      <span className="font-semibold text-foreground tabular-nums">{formatCLP(value)}</span>
      {reference && (
        // Se oculta si la tarjeta es angosta (carrusel, móvil): el precio actual nunca se corta.
        <span className="hidden text-muted-foreground text-xs tabular-nums line-through @[15rem]:inline">
          {formatCLP(reference)}
        </span>
      )}
    </p>
  ) : (
    <p className={cn("text-muted-foreground text-sm", className)}>Ver tiendas</p>
  );

const StockDot = ({ inStock }: { inStock: boolean }) => (
  <span aria-hidden className={cn("inline-block size-1.5 rounded-full", inStock ? "bg-success" : "bg-foreground/25")} />
);

// ─── v1 · Galería ────────────────────────────────────────────────────────────
// Punto de vista: el producto es el protagonista (Apple Store, Google Store). Sin borde de tarjeta: la foto vive en
// un panel suave y el texto respira debajo. Cotizar aparece al pasar el cursor (siempre visible en pantallas táctiles).

export function ProductCardGallery({ product, priority, trending, className }: ProductCardOptionProps) {
  const d = useCardData(product);
  return (
    <article className={cn("group @container relative flex flex-col", className)}>
      <Link
        {...d.link}
        className="flex flex-1 flex-col focus-visible:outline-none"
        aria-label={product.name ?? undefined}
      >
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-secondary dark:bg-foreground/90">
          <div className="absolute inset-0 p-[12%]">
            <ProductImage product={product} priority={priority} />
          </div>
          <div className="absolute top-3 left-3 flex gap-1.5">
            {d.hasRealDrop && (
              <span className="rounded-full bg-card px-2 py-0.5 font-semibold text-[11px] text-foreground tabular-nums">
                −{d.dropPct}%
              </span>
            )}
            {d.psu && <PsuBadge certification={d.psu} />}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 px-1 pt-3">
          <p className="flex items-center gap-1.5 truncate text-muted-foreground text-xs">
            {trending && <IconTrendingUp className="size-3.5 shrink-0" stroke={2} aria-label="Tendencia" />}
            {[product.brand?.name, ...d.specs].filter(Boolean).join(" · ")}
          </p>
          <h3 className="line-clamp-2 font-medium text-[15px] text-foreground leading-snug">{product.name}</h3>
          <Price value={d.current} reference={d.hasRealDrop ? d.reference : null} className="mt-auto pt-1.5" />
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs",
              d.inStock ? "text-muted-foreground" : "text-foreground/40",
            )}
          >
            <StockDot inStock={d.inStock} />
            {d.availability}
          </p>
        </div>
      </Link>
      <AddToQuote
        product={product}
        className={cn(
          "absolute top-3 right-3 size-9 bg-card/90 backdrop-blur-md transition-opacity",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      />
    </article>
  );
}

// ─── v2 · Comparador ─────────────────────────────────────────────────────────
// Punto de vista: decidir la compra (PriceSpy, idealo). Tarjeta con borde y un pie de precio claro: cuánto cuesta,
// cuánto con tarjeta, en cuántas tiendas y si hay stock. Cotizar siempre a mano.

export function ProductCardCompare({ product, priority, trending, className }: ProductCardOptionProps) {
  const d = useCardData(product);
  return (
    <article
      className={cn(
        "group @container flex h-full flex-col rounded-3xl border border-border bg-card p-2.5 transition-colors hover:border-foreground/15",
        className,
      )}
    >
      <Link
        {...d.link}
        className="flex flex-1 flex-col focus-visible:outline-none"
        aria-label={product.name ?? undefined}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white">
          <div className="absolute inset-0 p-[8%]">
            <ProductImage product={product} priority={priority} />
          </div>
          {d.psu && (
            <div className="absolute top-2.5 left-2.5">
              <PsuBadge certification={d.psu} />
            </div>
          )}
          {trending && (
            <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 font-medium text-[11px] text-foreground backdrop-blur-md">
              <IconTrendingUp className="size-3" /> Tendencia
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-1.5 pt-3">
          {product.brand?.name && <p className="text-muted-foreground text-xs">{product.brand.name}</p>}
          <h3 className="line-clamp-2 font-medium text-foreground text-sm leading-snug">{product.name}</h3>
          {d.specs.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {d.specs.map((s) => (
                <li key={s} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
      <div className="mt-3 flex items-end justify-between gap-2 border-border border-t px-1.5 pt-3 pb-0.5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Price value={d.current} reference={d.hasRealDrop ? d.reference : null} className="text-[17px]" />
            {d.hasRealDrop && (
              <span className="hidden rounded-full bg-success/15 px-1.5 py-0.5 font-semibold text-[11px] text-success @[17rem]:inline">
                −{d.dropPct}%
              </span>
            )}
          </div>
          <p className="flex items-center gap-1.5 truncate text-muted-foreground text-xs">
            <StockDot inStock={d.inStock} />
            {d.availability}
            {d.hasCardGap && d.card && <span className="hidden @[17rem]:inline">· tarjeta {formatCLP(d.card)}</span>}
          </p>
        </div>
        <AddToQuote product={product} className="size-9 shrink-0" />
      </div>
    </article>
  );
}

// ─── v3 · Fila ───────────────────────────────────────────────────────────────
// Punto de vista: escanear rápido (lista de eventos de Luma, filas de Newegg). Horizontal: el texto manda y la foto
// es una miniatura. En móvil es una lista cómoda; en escritorio se ordena en 2–3 columnas.

export function ProductCardRow({ product, priority, trending, className }: ProductCardOptionProps) {
  const d = useCardData(product);
  return (
    <article
      className={cn(
        "group @container relative flex gap-4 rounded-3xl border border-border bg-card p-3 transition-colors hover:border-foreground/15",
        className,
      )}
    >
      <Link
        {...d.link}
        className="flex min-w-0 flex-1 gap-4 focus-visible:outline-none"
        aria-label={product.name ?? undefined}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
          <p className="flex items-center gap-1.5 truncate text-muted-foreground text-xs">
            {product.brand?.name}
            {trending && (
              <span className="inline-flex items-center gap-0.5 text-foreground">
                · <IconTrendingUp className="size-3" /> Tendencia
              </span>
            )}
          </p>
          <h3 className="line-clamp-2 font-medium text-foreground text-sm leading-snug">{product.name}</h3>
          {d.specs.length > 0 && <p className="truncate text-muted-foreground text-xs">{d.specs.join(" · ")}</p>}
          <div className="mt-auto flex items-baseline gap-2 pt-2">
            <Price value={d.current} reference={d.hasRealDrop ? d.reference : null} />
            {d.hasRealDrop && <span className="font-semibold text-success text-xs">−{d.dropPct}%</span>}
          </div>
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <StockDot inStock={d.inStock} />
            {d.availability}
          </p>
        </div>
        <div className="relative size-24 shrink-0 self-center overflow-hidden rounded-2xl bg-white sm:size-28">
          <div className="absolute inset-0 p-2">
            <ProductImage product={product} priority={priority} />
          </div>
          {d.psu && (
            <div className="absolute bottom-1.5 left-1.5">
              <PsuBadge certification={d.psu} />
            </div>
          )}
        </div>
      </Link>
      <AddToQuote product={product} className="absolute right-4 bottom-4 size-8 bg-card/90 backdrop-blur-md" />
    </article>
  );
}
