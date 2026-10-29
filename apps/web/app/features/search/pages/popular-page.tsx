import { CatalogView } from "~/features/catalog/components/catalog-view";
import { loadCatalog } from "~/features/catalog/load-catalog";
import type { Route } from "./+types/popular-page";

export function meta() {
  return [
    { title: "Lo más popular en Chile - Framerate" },
    { name: "description", content: "Los productos de hardware más vistos esta semana en las tiendas de Chile." },
    { property: "og:title", content: "Lo más popular en Chile" },
    {
      property: "og:description",
      content: "Los productos de hardware más vistos esta semana en las tiendas de Chile.",
    },
    { property: "og:locale", content: "es_CL" },
  ];
}

export function loader({ url }: Route.LoaderArgs) {
  return loadCatalog(url, undefined, "popular");
}

export default function Page({ loaderData }: Route.ComponentProps) {
  return <CatalogView data={loaderData} />;
}
