import type { PublicQuote } from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import { Link } from "react-router";
import { buttonVariants } from "~/shared/components/primitives/button";
import { Carousel, CarouselContent, CarouselItem } from "~/shared/components/primitives/carousel";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { QuoteCard, QuoteSpecs } from "./quote-card";
import { QuoteLikeToggle } from "./quote-like-toggle";

export const PUBLIC_QUOTES_PAGE_SIZE = 18;

const componentes = (n: number) => `${n} ${n === 1 ? "componente" : "componentes"}`;
const pageHref = (n: number) => (n === 1 ? "/cotizaciones" : `/cotizaciones?pagina=${n}`);

function Row({ quote, rank }: { quote: PublicQuote; rank: number }) {
  return (
    <li className="relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/30 sm:gap-4 sm:px-4">
      <span className="w-6 shrink-0 text-center text-label-sm text-muted-foreground tabular-nums">{rank}</span>
      <ul aria-hidden className="flex shrink-0 gap-1">
        {quote.images.slice(0, 4).map((src, i) => (
          <li
            key={src}
            className={cn(
              "size-11 overflow-hidden rounded-lg bg-[var(--product-stage)] p-0.5",
              i > 0 && "hidden md:block",
            )}
          >
            <img
              src={imageVariant(src, 400)}
              alt=""
              loading="lazy"
              className="size-full object-contain mix-blend-multiply"
            />
          </li>
        ))}
      </ul>
      <div className="min-w-0 flex-1">
        <Link
          to={`/cotizacion/${quote.id}`}
          prefetch="intent"
          className="block truncate text-label-sm text-foreground after:absolute after:inset-0 hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          {quote.name}
        </Link>
        <span className="block truncate text-muted-foreground text-paragraph-xs">@{quote.author.username}</span>
      </div>
      <div className="hidden min-w-0 flex-1 flex-col gap-1 xl:flex">
        <QuoteSpecs quote={quote} />
      </div>
      <span className="hidden w-28 shrink-0 text-muted-foreground text-paragraph-sm lg:block">
        {componentes(quote.itemCount)}
      </span>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
        <span className="text-label-sm text-foreground tabular-nums sm:w-24 sm:text-right">
          {formatCLP(quote.totalCash)}
        </span>
        <span className="relative z-10">
          <QuoteLikeToggle quote={quote} />
        </span>
      </div>
    </li>
  );
}

/** Página 1: el top 3 en tarjetas (carrusel en teléfono) y el resto en filas numeradas; desde la 2, todo en filas. */
export function PublicQuotesList({ page, quotes }: { page: number; quotes: PublicQuote[] }) {
  const top = page === 1 ? quotes.slice(0, 3) : [];
  const rows = quotes.slice(top.length);
  const offset = (page - 1) * PUBLIC_QUOTES_PAGE_SIZE + top.length;
  const hasNext = quotes.length === PUBLIC_QUOTES_PAGE_SIZE;

  return (
    <div className="w-full space-y-6 pb-16">
      <header className="space-y-1 pt-4">
        <h1 className="text-foreground text-title-h5 md:text-title-h4">Cotizaciones populares</h1>
        <p className="text-muted-foreground text-paragraph-sm md:text-paragraph-md">
          Las cotizaciones públicas con más me gusta, con los precios de hoy.
        </p>
      </header>

      {quotes.length === 0 && (
        <p className="rounded-2xl border border-border/40 border-dashed p-8 text-center text-muted-foreground text-paragraph-sm">
          Todavía no hay cotizaciones públicas en esta página.
        </p>
      )}

      {top.length > 0 && (
        <>
          <Carousel className="w-full md:hidden">
            <CarouselContent className="-ml-3">
              {top.map((quote, i) => (
                <CarouselItem key={quote.id} className="basis-[80%] pl-3">
                  <QuoteCard quote={quote} rank={i + 1} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <ol className="hidden grid-cols-3 gap-3 md:grid">
            {top.map((quote, i) => (
              <li key={quote.id} className="flex">
                <QuoteCard quote={quote} rank={i + 1} />
              </li>
            ))}
          </ol>
        </>
      )}

      {rows.length > 0 && (
        <ol className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {rows.map((quote, i) => (
            <Row key={quote.id} quote={quote} rank={offset + i + 1} />
          ))}
        </ol>
      )}

      {(page > 1 || hasNext) && (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginación">
          {page > 1 ? (
            <Link to={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-paragraph-sm tabular-nums">Página {page}</span>
          {hasNext ? (
            <Link to={pageHref(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
