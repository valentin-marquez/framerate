import type { PublicQuote } from "@framerate/contracts";
import { Link } from "react-router";
import { QuoteCard } from "~/features/quote/components/quote-card";
import { Carousel, CarouselContent, CarouselItem } from "~/shared/components/primitives/carousel";

/** Con menos de tres, la fila queda corta y vacía: la sección no se muestra. */
export const MIN_PUBLIC_QUOTES = 3;

/** Cotizaciones públicas de más "me gusta" a menos, en una fila en carrusel como las de productos del inicio. */
export function PublicQuotes({ quotes }: { quotes: PublicQuote[] }) {
  if (quotes.length < MIN_PUBLIC_QUOTES) return null;
  return (
    <section className="space-y-3 [contain-intrinsic-size:auto_160px] [content-visibility:auto]">
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
      <Carousel className="w-full">
        <CarouselContent className="-ml-3">
          {quotes.map((quote, i) => (
            <CarouselItem key={quote.id} className="basis-[88%] pl-3 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
              <QuoteCard quote={quote} rank={i + 1} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
