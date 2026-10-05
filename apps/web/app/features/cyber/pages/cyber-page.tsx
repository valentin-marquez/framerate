import { categoryFromSlug } from "@framerate/contracts";
import { CatalogView } from "~/features/catalog/components/catalog-view";
import { loadCatalog } from "~/features/catalog/load-catalog";
import type { Route } from "./+types/cyber-page";

const TITLE = "Cyber Monday: bajas de precio en hardware - Framerate";
const DESCRIPTION =
  "Cyber Monday del 5 al 7 de octubre: componentes de PC más baratos que su precio habitual en tiendas de Chile. Comparamos el precio de hoy con el de los días anteriores.";

export function meta() {
  return [
    { title: TITLE },
    { name: "description", content: DESCRIPTION },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "es_CL" },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  const slug = new URL(request.url).searchParams.get("category");
  return loadCatalog(request, slug && categoryFromSlug(slug) ? slug : undefined, { deals: true });
}

export default function CyberPage({ loaderData }: Route.ComponentProps) {
  return <CatalogView data={loaderData} />;
}
