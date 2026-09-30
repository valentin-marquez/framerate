import { CatalogView } from "~/features/catalog/components/catalog-view";
import { loadCatalog } from "~/features/catalog/load-catalog";
import { getApiSlugFromUrl, getCategoryConfig } from "../utils/categories";
import type { Route } from "./+types/category-page";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.category) return [{ title: "Categoría no encontrada | Framerate" }];
  const { label } = getCategoryConfig(data.category);
  return [
    { title: `${label} - Precios y Ofertas en Chile | Framerate` },
    {
      name: "description",
      content: `Catálogo de ${label} con los precios más bajos de tiendas chilenas. Compara stock y ofertas de ${label} en Framerate.`,
    },
    { property: "og:title", content: `${label} - Precios en Chile` },
    { property: "og:description", content: `Encuentra las mejores ofertas de ${label} en Chile.` },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "es_CL" },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const category = getApiSlugFromUrl(params.slug);
  if (!category) throw new Response("Category not found", { status: 404 });
  return loadCatalog(request, category);
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  return <CatalogView data={loaderData} />;
}
