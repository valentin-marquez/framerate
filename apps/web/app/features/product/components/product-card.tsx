import type { ProductSummary } from "@framerate/contracts";
import { IconPhotoOff, IconTrendingUp } from "@tabler/icons-react";
import { useEffect, useId, useState } from "react";
import { Link, useViewTransitionState } from "react-router";
import { priceDrop } from "~/features/product/utils/price-drop";
import { getSpecsSummary } from "~/features/product/utils/specs";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Skeleton } from "~/shared/components/primitives/skeleton";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { AddToQuote } from "./add-to-quote";
import { PsuBadge } from "./psu-badge";

interface ProductCardProps {
  product: ProductSummary;
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
// Un producto puede salir dos veces en la misma página (dos filas de la home) y un view-transition-name repetido cancela
// la transición: lo lleva una sola tarjeta, la clickeada o, al volver de la ficha, la primera que se dibuja.
let morphOwner: string | null = null;

function useProductMorph(slug: string, cardId: string) {
  const morphing = useViewTransitionState(`/producto/${slug}`);
  if (morphing && morphOwner === null) morphOwner = cardId;
  useEffect(() => {
    if (!morphing && morphOwner === cardId) morphOwner = null;
  }, [morphing, cardId]);
  useEffect(
    () => () => {
      if (morphOwner === cardId) morphOwner = null;
    },
    [cardId],
  );
  return morphing && morphOwner === cardId;
}

function ProductStage({
  product,
  priority,
  psu,
  cardId,
}: {
  product: ProductSummary;
  priority: boolean;
  psu: string | null;
  cardId: string;
}) {
  const [stage, setStage] = useState<"loading" | "opening" | "open">("loading");
  // El panel pasa a ser la foto de la ficha (app.css).
  const morphing = useProductMorph(product.slug, cardId);

  if (!product.imageUrl) {
    return (
      <div className="relative col-start-1 row-start-1 flex w-[58%] items-center justify-end justify-self-end pr-8 text-foreground/20">
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
      className="relative col-start-1 row-start-1 isolate w-[58%] justify-self-end overflow-hidden"
      // El producto va alineado a la derecha: el orbe y la apertura nacen ahí, no en el centro del panel.
      style={{ "--reveal-x": "68%", viewTransitionName: morphing ? "product-photo" : undefined } as React.CSSProperties}
    >
      <div
        aria-hidden
        className="stage-backdrop absolute inset-0 bg-[var(--product-stage)]"
        data-state={stage === "opening" ? "open" : undefined}
      />
      <AsyncImage
        src={product.imageUrl}
        alt={product.name}
        priority={priority}
        reveal="none"
        onReady={(fromCache) => setStage(fromCache ? "open" : "opening")}
        data-state={stage === "opening" ? "open" : undefined}
        className="stage-image absolute inset-0 size-full object-contain object-right p-3 pl-0 mix-blend-multiply"
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

/** Un solo sello por fuente: 80 Plus si lo tiene, si no el de Cybenetics (ETA, después LAMBDA). */
function psuCertification({ category, attributes }: ProductSummary): string | null {
  if (category !== "psu") return null;
  const { efficiency, eta, lambda } = attributes;
  if (typeof efficiency === "string") return efficiency;
  if (typeof eta === "string") return `eta-${eta}`;
  return typeof lambda === "string" ? `lambda-${lambda}` : null;
}

/**
 * Tarjeta de producto, la misma en catálogo, home y tiendas. Horizontal: el texto manda (marca, nombre, specs,
 * precio y disponibilidad) y la foto es una miniatura a la derecha con el botón de cotizar encima.
 */
export function ProductCard({ product, priority = false, trending = false, className }: ProductCardProps) {
  const { bestPrice, bestCardPrice } = product;
  const specs = getSpecsSummary(product);
  const inStock = bestPrice !== null;
  const psu = psuCertification(product);
  const cardId = useId();
  const drop = priceDrop(bestPrice, product.referencePrice);

  return (
    <article
      className={cn(
        "group @container relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-foreground/15",
        className,
      )}
    >
      {/* Texto y foto comparten celda (se superponen) sin un contenedor posicionado: así el ::after del enlace
          se ancla al <article> y toda la tarjeta es clicable, no sólo la columna del texto. */}
      <div className="grid min-h-36">
        <ProductStage product={product} priority={priority} psu={psu} cardId={cardId} />

        <div className="z-[2] col-start-1 row-start-1 flex w-[58%] min-w-0 flex-col gap-1.5 p-3 pt-3.5 pb-2.5">
          <div className="flex h-5 items-center gap-2">
            {product.brand && <span className="truncate text-muted-foreground text-xs">{product.brand}</span>}
            {drop && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-medium text-[11px] text-emerald-700 tabular-nums dark:text-emerald-400">
                Bajó {formatCLP(drop.amount)} ({drop.percent}%)
              </span>
            )}
            {trending && !drop && (
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
              prefetch="intent"
              viewTransition
              onClick={() => {
                morphOwner = cardId;
              }}
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
            {bestPrice ? (
              <>
                <span className="font-semibold text-foreground tabular-nums">{formatCLP(bestPrice)}</span>
                {drop && product.referencePrice && (
                  <s className="text-muted-foreground text-xs tabular-nums" title="Precio habitual">
                    {formatCLP(product.referencePrice)}
                  </s>
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-sm">Ver tiendas</span>
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
              {availabilityText(inStock, product.offerCount)}
            </span>
            {bestPrice && bestCardPrice && bestCardPrice > bestPrice && (
              <span className="hidden text-muted-foreground tabular-nums @[20rem]:inline">
                Con tarjeta {formatCLP(bestCardPrice)}
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
