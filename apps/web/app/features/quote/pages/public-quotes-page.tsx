import { Link } from "react-router";
import { PRODUCT_GRID_CLASS } from "~/features/explore/components/product-grid-skeleton";
import { PublicQuoteCard } from "~/features/home/components/public-quotes";
import { quotesService } from "~/features/quote/services/quotes";
import { buttonVariants } from "~/shared/components/primitives/button";
import type { Route } from "./+types/public-quotes-page";

const PAGE_SIZE = 18;

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
    <div className="w-full space-y-6 pb-16">
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
        <ol className={PRODUCT_GRID_CLASS}>
          {quotes.map((quote, i) => (
            <li key={quote.id} className="flex">
              <PublicQuoteCard quote={quote} rank={(page - 1) * PAGE_SIZE + i + 1} />
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
