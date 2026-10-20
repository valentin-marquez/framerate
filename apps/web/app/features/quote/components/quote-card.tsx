import type { PublicQuote } from "@framerate/contracts";
import { Link } from "react-router";
import { formatCLP } from "~/shared/utils/format";
import { QuoteLikeToggle } from "./quote-like-toggle";

/**
 * Panel derecho de la tarjeta, como el de `ProductCard`: las fotos son el fondo y se funden hacia la izquierda con el
 * velo `scrim-card-to-r`. Son las cuatro primeras por importancia (gabinete, procesador, placa madre, gráfica), en
 * cuadrícula; donde falta una, queda el fondo.
 */
function Stage({ images }: { images: string[] }) {
  return (
    <div className="relative isolate col-start-1 row-start-1 w-[58%] justify-self-end overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-[var(--product-stage)]" />
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 p-1 pl-0">
        {images.slice(0, 4).map((src) => (
          <img key={src} src={src} alt="" loading="lazy" className="size-full object-contain p-1 mix-blend-multiply" />
        ))}
      </div>
      <div aria-hidden className="scrim-card-to-r absolute inset-y-0 left-0 w-3/5" />
      {/* En oscuro el panel es más claro que el pie: se funde también hacia abajo para no cortar en seco. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 hidden h-2/5 bg-gradient-to-t from-card to-transparent dark:block"
      />
    </div>
  );
}

interface QuoteCardProps {
  quote: PublicQuote;
  /** Lugar en el ranking por me gusta; el primero lleva la etiqueta "La más querida". */
  rank: number;
}

/** Cotización pública con la geometría de `ProductCard`: texto a la izquierda, fotos a la derecha y pie con total y me gusta. */
export function QuoteCard({ quote, rank }: QuoteCardProps) {
  return (
    <article className="group @container relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-foreground/15">
      <div className="grid min-h-36">
        <Stage images={quote.images} />
        <div className="z-[2] col-start-1 row-start-1 flex w-[58%] min-w-0 flex-col gap-1.5 p-3 pt-3.5 pb-2.5">
          <div className="flex h-5 items-center gap-2">
            <span className="truncate text-muted-foreground text-xs">@{quote.author.username}</span>
            {rank === 1 && (
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 font-medium text-[11px] text-foreground">
                La más querida
              </span>
            )}
          </div>
          <h3 className="line-clamp-2 min-h-[2.75em] font-medium text-foreground text-sm leading-snug">
            {/* El enlace cubre toda la tarjeta (::after); el me gusta queda por encima. */}
            <Link
              to={`/cotizacion/${quote.id}`}
              prefetch="intent"
              className="after:absolute after:inset-0 after:z-[1] after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {quote.name}
            </Link>
          </h3>
          <ul className="flex flex-wrap gap-1">
            <li className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">
              #{rank}
            </li>
            <li className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">
              {quote.itemCount} {quote.itemCount === 1 ? "componente" : "componentes"}
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-border border-t px-3 py-2.5">
        <div className="min-w-0 space-y-0.5">
          <span className="block font-semibold text-foreground tabular-nums">{formatCLP(quote.totalCash)}</span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
            <span aria-hidden className="size-1.5 rounded-full bg-success" />
            Precios de hoy
          </span>
        </div>
        <span className="relative z-10 shrink-0">
          <QuoteLikeToggle quote={quote} />
        </span>
      </div>
    </article>
  );
}
