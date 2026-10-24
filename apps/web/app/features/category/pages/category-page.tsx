import { categoryFromSlug } from "@framerate/contracts";
import { CatalogView } from "~/features/catalog/components/catalog-view";
import { loadCatalog } from "~/features/catalog/load-catalog";
import { categoryLabel } from "../utils/categories";
import type { Route } from "./+types/category-page";

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data?.category) return [{ title: "Categoría no encontrada - Framerate" }];
  // A media frase va en minúscula: "Precios de fuentes de poder", "de memoria RAM".
  const name = categoryLabel(data.category);
  const label = name.charAt(0).toLowerCase() + name.slice(1);
  return [
    { title: `Precios de ${label} en Chile - Framerate` },
    {
      name: "description",
      content: `Catálogo de ${label} con los precios más bajos de tiendas chilenas. Compara stock y ofertas de ${label} en Framerate.`,
    },
    { property: "og:title", content: `Precios de ${label} en Chile` },
    { property: "og:description", content: `Encuentra las mejores ofertas de ${label} en Chile.` },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "es_CL" },
  ];
}

export async function loader({ params, url }: Route.LoaderArgs) {
  if (!categoryFromSlug(params.slug)) throw new Response("Category not found", { status: 404 });
  return loadCatalog(url, params.slug);
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  return <CatalogView data={loaderData} />;
}
