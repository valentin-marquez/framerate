import { CatalogView } from "~/features/catalog/components/catalog-view";
import { loadCatalog } from "~/features/catalog/load-catalog";
import type { Route } from "./+types/search-page";

export function meta({ loaderData: data }: Route.MetaArgs) {
  const title = data?.search ? `${data.search}: precios en Chile - Framerate` : "Buscar hardware - Framerate";
  return [
    { title },
    {
      name: "description",
      content: "Busca y compara hardware con los mejores precios en Chile. Filtra por marca, precio y stock.",
    },
    { property: "og:title", content: title },
    { property: "og:description", content: "Encuentra las mejores ofertas de hardware en Chile." },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "es_CL" },
    // Google no quiere resultados de búsqueda interna en su índice; los enlaces sí se siguen.
    { name: "robots", content: "noindex, follow" },
  ];
}

export function loader({ url }: Route.LoaderArgs) {
  return loadCatalog(url);
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  return <CatalogView data={loaderData} />;
}
