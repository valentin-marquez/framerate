import type { PublicQuote } from "@framerate/contracts";
import { IconHeart } from "@tabler/icons-react";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getGradient } from "~/shared/utils/gradients";

/** Con menos de tres, la destacada y la lista quedarían huecas: la sección no se muestra. */
export const MIN_PUBLIC_QUOTES = 3;

export const authorLine = (quote: PublicQuote) =>
  `${quote.author.displayName} con ${quote.itemCount} ${quote.itemCount === 1 ? "componente" : "componentes"}`;

export function Likes({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-sm tabular-nums">
      <IconHeart className="size-4" aria-label="Me gusta" />
      {count}
    </span>
  );
}

/** Las fotos de los componentes en cuadrícula; donde falta una, un degradado propio de la cotización. */
export function Collage({ quote, className }: { quote: PublicQuote; className?: string }) {
  return (
    <span className={cn("grid shrink-0 grid-cols-2 gap-0.5 overflow-hidden bg-secondary/40", className)}>
      {Array.from({ length: 4 }, (_, i) => quote.images[i]).map((src, i) =>
        src ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: son cuatro celdas fijas
          <img key={i} src={src} alt="" loading="lazy" className="size-full bg-white object-contain" />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: son cuatro celdas fijas
          <span key={i} className="size-full opacity-55" style={{ background: getGradient(`${quote.id}${i}`) }} />
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
        <Link
          to={`/cotizacion/${top.id}`}
          prefetch="intent"
          className="group flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card transition-colors hover:border-primary/40 sm:flex-row lg:col-span-3"
        >
          <Collage quote={top} className="aspect-[4/3] w-full sm:w-2/5" />
          <span className="flex flex-1 flex-col gap-2 p-4">
            <span className="font-mono text-muted-foreground text-xs">Las más queridas, #1</span>
            <span className="text-foreground text-title-h6 transition-colors group-hover:text-primary">{top.name}</span>
            {top.description && <span className="line-clamp-3 text-muted-foreground text-sm">{top.description}</span>}
            <span className="text-muted-foreground text-xs">{authorLine(top)}</span>
            <span className="mt-auto flex items-center justify-between pt-2">
              <span className="font-mono text-foreground tabular-nums">{formatCLP(top.totalCash)}</span>
              <Likes count={top.likeCount} />
            </span>
          </span>
        </Link>
        <ol className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40 bg-card lg:col-span-2">
          {rest.map((quote, i) => (
            <li key={quote.id} className="flex-1">
              <Link
                to={`/cotizacion/${quote.id}`}
                prefetch="intent"
                className="flex h-full items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40"
              >
                <span className="w-5 shrink-0 text-center font-mono text-muted-foreground text-sm tabular-nums">
                  {i + 2}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground text-sm">{quote.name}</span>
                  <span className="block truncate font-mono text-muted-foreground text-xs tabular-nums">
                    {formatCLP(quote.totalCash)}
                  </span>
                </span>
                <Likes count={quote.likeCount} />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
