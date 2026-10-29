import { CatalogView } from "~/features/catalog/components/catalog-view";
import { loadCatalog } from "~/features/catalog/load-catalog";
import type { Route } from "./+types/drops-page";

export function meta() {
  return [
    { title: "Bajadas de precio en Chile - Framerate" },
    { name: "description", content: "Hardware con al menos 3 % de baja bajo su precio habitual en tiendas de Chile." },
    { property: "og:title", content: "Bajadas de precio en Chile" },
    {
      property: "og:description",
      content: "Hardware con al menos 3 % de baja bajo su precio habitual en tiendas de Chile.",
    },
    { property: "og:locale", content: "es_CL" },
  ];
}

export function loader({ url }: Route.LoaderArgs) {
  return loadCatalog(url, undefined, "drops");
}

export default function Page({ loaderData }: Route.ComponentProps) {
  return <CatalogView data={loaderData} />;
}
