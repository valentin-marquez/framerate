import type { PublicQuote } from "@framerate/contracts";
import { Link } from "react-router";
import { QuoteCard } from "~/features/quote/components/quote-card";

/** La grilla es de cuatro iguales: con menos queda un hueco, así que la sección no se muestra. */
export const MIN_PUBLIC_QUOTES = 4;

/** Las cuatro cotizaciones públicas con más "me gusta": dos columnas en teléfono y cuatro en escritorio. */
export function PublicQuotes({ quotes }: { quotes: PublicQuote[] }) {
  if (quotes.length < MIN_PUBLIC_QUOTES) return null;
  return (
    <section className="space-y-3 [contain-intrinsic-size:auto_480px] [content-visibility:auto]">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-foreground text-label-lg md:text-title-h6">Cotizaciones populares</h2>
        <Link
          to="/cotizaciones"
          prefetch="intent"
          className="shrink-0 text-label-sm text-muted-foreground transition-colors hover:text-primary"
        >
          Ver más
        </Link>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {quotes.slice(0, MIN_PUBLIC_QUOTES).map((quote, i) => (
          <li key={quote.id} className="flex min-w-0">
            <QuoteCard quote={quote} rank={i === 0 ? 1 : undefined} />
          </li>
        ))}
      </ol>
    </section>
  );
}
