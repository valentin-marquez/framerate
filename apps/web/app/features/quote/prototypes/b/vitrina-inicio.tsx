import type { PublicQuote } from "@framerate/contracts";
import { Link } from "react-router";
import { QuoteLikeToggle } from "~/features/quote/components/quote-like-toggle";
import { Carousel, CarouselContent, CarouselItem } from "~/shared/components/primitives/carousel";
import { formatCLP } from "~/shared/utils/format";
import { Collage, componentes, Thumbs } from "./piezas";

const cover =
  "after:absolute after:inset-0 after:z-[1] after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";

/** La más querida, grande: el armado ocupa dos tercios y al lado su ficha, como la vitrina destacada de una tienda. */
function Featured({ quote }: { quote: PublicQuote }) {
  return (
    <article className="group relative grid overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-foreground/15 md:grid-cols-5 lg:grid-cols-3">
      <Collage
        images={quote.images}
        className="aspect-[16/10] md:col-span-3 md:aspect-auto md:h-full md:min-h-72 lg:col-span-2"
      />
      <div className="flex min-w-0 flex-col gap-4 p-5 md:col-span-2 lg:col-span-1">
        <div className="space-y-1.5">
          <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-label-xs text-foreground">
            La más querida
          </span>
          <h3 className="text-title-h5 text-foreground">
            <Link to={`/cotizacion/${quote.id}`} prefetch="intent" className={cover}>
              {quote.name}
            </Link>
          </h3>
          <p className="text-muted-foreground text-paragraph-sm">@{quote.author.username}</p>
        </div>
        {quote.description && (
          <p className="line-clamp-3 text-muted-foreground text-paragraph-sm">{quote.description}</p>
        )}
        <div className="space-y-2">
          <span className="text-label-xs text-muted-foreground">En este armado</span>
          <Thumbs images={quote.images} />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 border-border border-t pt-4">
          <div>
            <span className="block text-title-h5 text-foreground tabular-nums">{formatCLP(quote.totalCash)}</span>
            <span className="text-muted-foreground text-paragraph-xs">
              {componentes(quote.itemCount)} con precios de hoy
            </span>
          </div>
          <span className="relative z-10 shrink-0">
            <QuoteLikeToggle quote={quote} />
          </span>
        </div>
      </div>
    </article>
  );
}

/** Tarjeta chica: foto, nombre, total y me gusta. Es la misma en la fila de escritorio y en el carrusel del teléfono. */
function Small({ quote, rank }: { quote: PublicQuote; rank: number }) {
  return (
    <article className="group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-foreground/15">
      <Collage images={quote.images} small className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0 space-y-0.5">
          <span className="text-muted-foreground text-paragraph-xs tabular-nums">#{rank}</span>
          <h3 className="line-clamp-2 text-label-sm text-foreground">
            <Link to={`/cotizacion/${quote.id}`} prefetch="intent" className={cover}>
              {quote.name}
            </Link>
          </h3>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-label-md text-foreground tabular-nums">{formatCLP(quote.totalCash)}</span>
          <span className="relative z-10 shrink-0">
            <QuoteLikeToggle quote={quote} />
          </span>
        </div>
      </div>
    </article>
  );
}

export function VitrinaInicio({ quotes }: { quotes: PublicQuote[] }) {
  const [first, ...rest] = quotes.slice(0, 5);
  if (!first) return null;
  return (
    <section className="space-y-3">
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

      {/* Teléfono: carrusel con imán que deja asomar la siguiente; el cambio de composición es sólo CSS. */}
      <Carousel className="w-full md:hidden">
        <CarouselContent className="-ml-3">
          {quotes.slice(0, 5).map((quote, i) => (
            <CarouselItem key={quote.id} className="basis-[80%] pl-3">
              <Small quote={quote} rank={i + 1} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="hidden space-y-3 md:block">
        <Featured quote={first} />
        <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {rest.map((quote, i) => (
            <li key={quote.id} className="flex">
              <Small quote={quote} rank={i + 2} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
