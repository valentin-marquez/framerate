import { redirect } from "react-router";
import { CatalogView } from "~/features/catalog/components/catalog-view";
import { loadCatalog } from "~/features/catalog/load-catalog";
import { getCategoryConfig } from "~/features/category/utils/categories";
import type { Route } from "./+types/explore-page";

export function meta() {
  return [
    { title: "Explorar hardware - Precios y Ofertas | Framerate" },
    {
      name: "description",
      content: "Explora y compara hardware con los mejores precios en Chile. Filtra por marca, precio y stock.",
    },
    { property: "og:title", content: "Explorar hardware | Framerate" },
    { property: "og:description", content: "Encuentra las mejores ofertas de hardware en Chile." },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "es_CL" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  // Los enlaces viejos usaban /explorar?category=: la categoría ahora tiene su propia URL.
  const legacyCategory = url.searchParams.get("category");
  if (legacyCategory) {
    url.searchParams.delete("category");
    const query = url.searchParams.toString();
    throw redirect(`/categoria/${getCategoryConfig(legacyCategory).urlSlug}${query ? `?${query}` : ""}`, 301);
  }
  return loadCatalog(request);
}

export default function ExplorePage({ loaderData }: Route.ComponentProps) {
  return <CatalogView data={loaderData} />;
}
