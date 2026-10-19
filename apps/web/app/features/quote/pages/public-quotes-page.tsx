import { Link } from "react-router";
import { authorLine, Collage, Likes } from "~/features/home/components/public-quotes";
import { quotesService } from "~/features/quote/services/quotes";
import { buttonVariants } from "~/shared/components/primitives/button";
import { formatCLP } from "~/shared/utils/format";
import type { Route } from "./+types/public-quotes-page";

const PAGE_SIZE = 20;

export function meta() {
  return [
    { title: "Cotizaciones populares de PC - Framerate" },
    {
      name: "description",
      content: "Las cotizaciones de PC públicas con más me gusta, con sus precios actualizados en tiendas chilenas.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const raw = Number(new URL(request.url).searchParams.get("pagina"));
  const page = Number.isInteger(raw) && raw >= 1 ? Math.min(raw, 500) : 1;
  const quotes = await quotesService.getPublic(PAGE_SIZE, page).catch(() => []);
  return { page, quotes };
}

export default function PublicQuotesPage({ loaderData: { page, quotes } }: Route.ComponentProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-16">
      <header className="space-y-1 pt-4">
        <h1 className="text-foreground text-title-h5 md:text-title-h4">Cotizaciones populares</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Las cotizaciones públicas con más me gusta, de más a menos.
        </p>
      </header>

      {quotes.length === 0 ? (
        <p className="rounded-2xl border border-border/40 border-dashed p-8 text-center text-muted-foreground text-sm">
          Todavía no hay cotizaciones públicas en esta página.
        </p>
      ) : (
        <ol className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40 bg-card">
          {quotes.map((quote, i) => (
            <li key={quote.id}>
              <Link
                to={`/cotizacion/${quote.id}`}
                prefetch="intent"
                className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/40 sm:gap-4 sm:px-4"
              >
                <span className="w-6 shrink-0 text-center font-mono text-muted-foreground text-sm tabular-nums">
                  {(page - 1) * PAGE_SIZE + i + 1}
                </span>
                <Collage quote={quote} className="size-14 rounded-xl sm:size-16" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground text-sm sm:text-base">{quote.name}</span>
                  <span className="block truncate text-muted-foreground text-xs sm:text-sm">{authorLine(quote)}</span>
                  <span className="block font-mono text-foreground text-sm tabular-nums sm:hidden">
                    {formatCLP(quote.totalCash)}
                  </span>
                </span>
                <span className="hidden font-mono text-foreground text-sm tabular-nums sm:block">
                  {formatCLP(quote.totalCash)}
                </span>
                <Likes count={quote.likeCount} />
              </Link>
            </li>
          ))}
        </ol>
      )}

      {(page > 1 || quotes.length === PAGE_SIZE) && (
        <nav className="flex items-center justify-between" aria-label="Paginación">
          {page > 1 ? (
            <Link
              to={page === 2 ? "/cotizaciones" : `/cotizaciones?pagina=${page - 1}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {quotes.length === PAGE_SIZE && (
            <Link
              to={`/cotizaciones?pagina=${page + 1}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
