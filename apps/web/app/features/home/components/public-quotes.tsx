import type { PublicQuote } from "@framerate/contracts";
import { Link } from "react-router";
import { QuoteLikeToggle } from "~/features/quote/components/quote-like-toggle";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getGradient } from "~/shared/utils/gradients";

/** Con menos de tres, la destacada y la lista quedarían huecas: la sección no se muestra. */
export const MIN_PUBLIC_QUOTES = 3;

export const authorLine = (quote: PublicQuote) =>
  `@${quote.author.username} con ${quote.itemCount} ${quote.itemCount === 1 ? "componente" : "componentes"}`;

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

/** Una foto en su celda: entra entera y centrada; donde falta, un degradado propio de la cotización. */
function Photo({ quote, index, className }: { quote: PublicQuote; index: number; className?: string }) {
  const src = quote.images[index];
  return (
    <span className={cn("relative block min-h-0 min-w-0 overflow-hidden bg-white", className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-contain" />
      ) : (
        <span className="absolute inset-0 opacity-55" style={{ background: getGradient(`${quote.id}${index}`) }} />
      )}
    </span>
  );
}

/** Las fotos de los componentes en cuadrícula, en cuatro celdas iguales (las primeras por importancia de la API). */
export function Collage({ quote, className }: { quote: PublicQuote; className?: string }) {
  return (
    <span className={cn("grid shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-secondary/40", className)}>
      {[0, 1, 2, 3].map((i) => (
        <Photo key={i} quote={quote} index={i} />
      ))}
    </span>
  );
}

/** Tarjeta grande de `/cotizaciones`: el collage de cuatro fotos arriba y, abajo, nombre, autor, total y me gusta. */
export function PublicQuoteCard({ quote, rank }: { quote: PublicQuote; rank: number }) {
  return (
    <div className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border/40 bg-card transition-colors hover:border-primary/40">
      <CardLink quote={quote} />
      <span className="pointer-events-none relative block">
        <Collage quote={quote} className="aspect-[4/3] w-full" />
        <span className="absolute top-2 left-2 rounded-lg bg-background/90 px-2 py-0.5 font-mono text-foreground text-xs tabular-nums">
          #{rank}
        </span>
      </span>
      <span className="pointer-events-none flex flex-1 flex-col gap-1.5 p-4">
        <span className="line-clamp-2 text-foreground text-label-lg transition-colors group-hover:text-primary">
          {quote.name}
        </span>
        {quote.description && <span className="line-clamp-2 text-muted-foreground text-sm">{quote.description}</span>}
        <span className="text-muted-foreground text-xs">{authorLine(quote)}</span>
        <span className="mt-auto flex items-center justify-between pt-2">
          <span className="font-mono text-foreground tabular-nums">{formatCLP(quote.totalCash)}</span>
          <LikeSlot quote={quote} />
        </span>
      </span>
    </div>
  );
}

const bentoCell =
  "group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card transition-colors hover:border-primary/40";

/**
 * Cotizaciones públicas de más "me gusta" a menos en bento: la primera ocupa dos por dos con el collage de cuatro fotos y
 * las otras (hasta cuatro) una celda con dos fotos. Con tres o cuatro en total, las últimas se ensanchan para no dejar
 * huecos.
 */
export function PublicQuotes({ quotes }: { quotes: PublicQuote[] }) {
  const [top, ...others] = quotes;
  if (!top || quotes.length < MIN_PUBLIC_QUOTES) return null;
  const rest = others.slice(0, 4);
  // Las celdas chicas dan la altura de la fila (su foto tiene proporción fija); ensancharlas pide una tira más baja.
  const cellOf = (i: number) =>
    rest.length === 2
      ? { cell: "lg:col-span-2", photos: "aspect-[2/1] lg:aspect-[6/1]" }
      : rest.length === 3 && i === 2
        ? { cell: "col-span-2", photos: "aspect-[4/1] lg:aspect-[6/1]" }
        : { cell: "", photos: "aspect-[2/1] lg:aspect-[3/1]" };
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-2">
        <div className={cn(bentoCell, "col-span-2 row-span-2")}>
          <CardLink quote={top} />
          <Collage quote={top} className="pointer-events-none aspect-[4/3] lg:aspect-auto lg:min-h-0 lg:flex-1" />
          <span className="pointer-events-none flex items-end justify-between gap-3 p-4">
            <span className="min-w-0">
              <span className="block font-mono text-muted-foreground text-xs">La más querida, #1</span>
              <span className="block truncate text-foreground text-title-h6 transition-colors group-hover:text-primary">
                {top.name}
              </span>
              <span className="block truncate text-muted-foreground text-xs">{authorLine(top)}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-foreground tabular-nums">{formatCLP(top.totalCash)}</span>
              <LikeSlot quote={top} />
            </span>
          </span>
        </div>
        {rest.map((quote, i) => (
          <div key={quote.id} className={cn(bentoCell, cellOf(i).cell)}>
            <CardLink quote={quote} />
            <span className={cn("pointer-events-none grid grid-cols-2 gap-0.5 bg-secondary/40", cellOf(i).photos)}>
              <Photo quote={quote} index={0} />
              <Photo quote={quote} index={1} />
            </span>
            <span className="pointer-events-none flex flex-col gap-1 p-3">
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-muted-foreground text-xs tabular-nums">#{i + 2}</span>
                <span className="truncate font-medium text-foreground text-sm transition-colors group-hover:text-primary">
                  {quote.name}
                </span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-foreground text-sm tabular-nums">{formatCLP(quote.totalCash)}</span>
                <LikeSlot quote={quote} />
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
