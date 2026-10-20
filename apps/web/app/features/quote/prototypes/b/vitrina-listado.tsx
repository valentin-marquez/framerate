import type { PublicQuote } from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import { useState } from "react";
import { Link } from "react-router";
import { QuoteLikeToggle } from "~/features/quote/components/quote-like-toggle";
import { Button } from "~/shared/components/primitives/button";
import { Carousel, CarouselContent, CarouselItem } from "~/shared/components/primitives/carousel";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { Collage, componentes, Rank } from "./piezas";

const PERIODS = ["Esta semana", "Este mes", "Siempre"] as const;

const cover =
  "after:absolute after:inset-0 after:z-[1] after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";

function TopCard({ quote, rank }: { quote: PublicQuote; rank: number }) {
  return (
    <article className="group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-foreground/15">
      <div className="relative">
        <Collage images={quote.images} className="aspect-[4/3]" />
        <Rank n={rank} className="absolute top-3 left-3" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 space-y-0.5">
          <h2 className="line-clamp-2 text-label-md text-foreground">
            <Link to={`/cotizacion/${quote.id}`} prefetch="intent" className={cover}>
              {quote.name}
            </Link>
          </h2>
          <p className="text-muted-foreground text-paragraph-xs">
            @{quote.author.username} con {componentes(quote.itemCount)}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-border border-t pt-3">
          <span className="text-label-lg text-foreground tabular-nums">{formatCLP(quote.totalCash)}</span>
          <span className="relative z-10 shrink-0">
            <QuoteLikeToggle quote={quote} />
          </span>
        </div>
      </div>
    </article>
  );
}

function Row({ quote, rank }: { quote: PublicQuote; rank: number }) {
  return (
    <li className="group relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/30 sm:gap-4 sm:px-4">
      <span className="w-6 shrink-0 text-center text-label-sm text-muted-foreground tabular-nums">{rank}</span>
      <ul className="flex shrink-0 gap-1">
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
          className="block truncate text-label-sm text-foreground after:absolute after:inset-0 hover:text-primary"
        >
          {quote.name}
        </Link>
        <span className="block truncate text-muted-foreground text-paragraph-xs">@{quote.author.username}</span>
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

export function VitrinaListado({ quotes, page = 1 }: { quotes: PublicQuote[]; page?: number }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("Este mes");
  const top = page === 1 ? quotes.slice(0, 3) : [];
  const rows = quotes.slice(top.length);

  return (
    <div className="w-full space-y-6 pb-16">
      <header className="space-y-4 pt-4">
        <div className="space-y-1">
          <h1 className="text-foreground text-title-h5 md:text-title-h4">Cotizaciones populares</h1>
          <p className="text-muted-foreground text-paragraph-sm md:text-paragraph-md">
            Las cotizaciones públicas con más me gusta, con los precios de hoy.
          </p>
        </div>
        {/* Visual en el prototipo: cambiar de periodo no cambia los datos. */}
        <div role="tablist" aria-label="Periodo" className="flex gap-1 border-border border-b">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === period}
              onClick={() => setPeriod(p)}
              className={cn(
                "-mb-px cursor-pointer border-b-2 px-3 py-2 text-label-sm transition-colors",
                p === period
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      {top.length > 0 && (
        <>
          <Carousel className="w-full md:hidden">
            <CarouselContent className="-ml-3">
              {top.map((quote, i) => (
                <CarouselItem key={quote.id} className="basis-[80%] pl-3">
                  <TopCard quote={quote} rank={i + 1} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <ol className="hidden grid-cols-3 gap-3 md:grid">
            {top.map((quote, i) => (
              <li key={quote.id} className="flex">
                <TopCard quote={quote} rank={i + 1} />
              </li>
            ))}
          </ol>
        </>
      )}

      <ol className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
        {rows.map((quote, i) => (
          <Row key={quote.id} quote={quote} rank={(page - 1) * 18 + top.length + i + 1} />
        ))}
      </ol>

      <nav className="flex items-center justify-between gap-3" aria-label="Paginación">
        <Button variant="outline" size="sm" disabled={page === 1}>
          Anterior
        </Button>
        <span className="text-muted-foreground text-paragraph-sm tabular-nums">Página {page}</span>
        <Button variant="outline" size="sm">
          Siguiente
        </Button>
      </nav>
    </div>
  );
}
