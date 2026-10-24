import { PUBLIC_QUOTES_PAGE_SIZE, PublicQuotesList } from "~/features/quote/components/public-quotes-list";
import { quotesService } from "~/features/quote/services/quotes";
import type { Route } from "./+types/public-quotes-page";

export function meta() {
  return [
    { title: "Cotizaciones populares de PC - Framerate" },
    {
      name: "description",
      content: "Las cotizaciones de PC públicas con más me gusta, con sus precios actualizados en tiendas chilenas.",
    },
  ];
}

export async function loader({ url }: Route.LoaderArgs) {
  const raw = Number(url.searchParams.get("pagina"));
  const page = Number.isInteger(raw) && raw >= 1 ? Math.min(raw, 500) : 1;
  const quotes = await quotesService.getPublic(PUBLIC_QUOTES_PAGE_SIZE, page).catch(() => []);
  return { page, quotes };
}

export default function PublicQuotesPage({ loaderData: { page, quotes } }: Route.ComponentProps) {
  return <PublicQuotesList page={page} quotes={quotes} />;
}
