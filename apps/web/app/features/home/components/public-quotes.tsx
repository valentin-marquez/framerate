import type { PublicQuote } from "@framerate/contracts";
import { IconHeart } from "@tabler/icons-react";
import { Link } from "react-router";
import { QuoteLikeToggle } from "~/features/quote/components/quote-like-toggle";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getGradient } from "~/shared/utils/gradients";

/** Con menos de tres, la destacada y la lista quedarían huecas: la sección no se muestra. */
export const MIN_PUBLIC_QUOTES = 3;

export const authorLine = (quote: PublicQuote) =>
  `@${quote.author.username} con ${quote.itemCount} ${quote.itemCount === 1 ? "componente" : "componentes"}`;

export function Likes({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-sm tabular-nums">
      <IconHeart className="size-4" aria-label="Me gusta" />
      {count}
    </span>
  );
}

/**
 * Enlace que cubre toda la tarjeta: el me gusta es un botón y no puede ir dentro de otro enlace. El contenido no
 * recibe clics (`pointer-events-none`) y el botón los recupera con `LikeSlot`.
 */
export function CardLink({ quote }: { quote: Pick<PublicQuote, "id" | "name"> }) {
  return (
    <Link
      to={`/cotizacion/${quote.id}`}
      prefetch="intent"
      aria-label={quote.name}
      className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-ring"
    />
  );
}

export function LikeSlot({ quote }: { quote: PublicQuote }) {
  return (
    <span className="pointer-events-auto relative z-10">
      <QuoteLikeToggle quote={quote} />
    </span>
  );
}

/** Las fotos de los componentes en cuadrícula; donde falta una, un degradado propio de la cotización. */
export function Collage({ quote, className }: { quote: PublicQuote; className?: string }) {
  return (
    <span className={cn("grid shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-secondary/40", className)}>
      {Array.from({ length: 4 }, (_, i) => quote.images[i]).map((src, i) =>
        src ? (
          // Cuatro celdas iguales: la foto se centra y entra entera en la suya, sin que una crezca a costa de otra.
          // biome-ignore lint/suspicious/noArrayIndexKey: son cuatro celdas fijas
          <span key={i} className="relative min-h-0 min-w-0 bg-white">
            <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-contain" />
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: son cuatro celdas fijas
          <span key={i} className="min-h-0 min-w-0 opacity-55" style={{ background: getGradient(`${quote.id}${i}`) }} />
        ),
      )}
    </span>
  );
}

/** Cotizaciones públicas de más "me gusta" a menos: la primera en grande y las siguientes en una lista. */
export function PublicQuotes({ quotes }: { quotes: PublicQuote[] }) {
  const [top, ...rest] = quotes;
  if (!top || quotes.length < MIN_PUBLIC_QUOTES) return null;
  return (
    <section className="space-y-3 [contain-intrinsic-size:auto_300px] [content-visibility:auto]">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-foreground text-label-lg md:text-title-h6">Cotizaciones populares</h2>
        <Link
          to="/cotizaciones"
          prefetch="intent"
          className="shrink-0 font-medium text-muted-foreground text-sm transition-colors hover:text-primary"
        >
          Ver más
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card transition-colors hover:border-primary/40 sm:flex-row lg:col-span-3">
          <CardLink quote={top} />
          <Collage quote={top} className="pointer-events-none aspect-[4/3] w-full sm:w-2/5" />
          <span className="pointer-events-none flex flex-1 flex-col gap-2 p-4">
            <span className="font-mono text-muted-foreground text-xs">Las más queridas, #1</span>
            <span className="text-foreground text-title-h6 transition-colors group-hover:text-primary">{top.name}</span>
            {top.description && <span className="line-clamp-3 text-muted-foreground text-sm">{top.description}</span>}
            <span className="text-muted-foreground text-xs">{authorLine(top)}</span>
            <span className="mt-auto flex items-center justify-between pt-2">
              <span className="font-mono text-foreground tabular-nums">{formatCLP(top.totalCash)}</span>
              <LikeSlot quote={top} />
            </span>
          </span>
        </div>
        <ol className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40 bg-card lg:col-span-2">
          {rest.map((quote, i) => (
            <li
              key={quote.id}
              className="relative flex flex-1 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40"
            >
              <CardLink quote={quote} />
              <span className="pointer-events-none w-5 shrink-0 text-center font-mono text-muted-foreground text-sm tabular-nums">
                {i + 2}
              </span>
              <span className="pointer-events-none min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground text-sm">{quote.name}</span>
                <span className="block truncate font-mono text-muted-foreground text-xs tabular-nums">
                  {formatCLP(quote.totalCash)}
                </span>
              </span>
              <LikeSlot quote={quote} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
