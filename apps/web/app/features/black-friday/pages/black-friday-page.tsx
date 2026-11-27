import { categoryFromSlug } from "@framerate/contracts";
import { CatalogView } from "~/features/catalog/components/catalog-view";
import { loadCatalog } from "~/features/catalog/load-catalog";
import { categoriesService } from "~/features/category/services/categories";
import { BlackFridayHeader, CategoryChips } from "../components/black-friday-header";
import type { Route } from "./+types/black-friday-page";

const TITLE = "Black Friday: bajas de precio en hardware - Framerate";
const DESCRIPTION =
  "Black Friday en Chile: componentes de PC más baratos que su precio habitual del último mes, comparados entre tiendas.";

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

export async function loader({ url }: Route.LoaderArgs) {
  const slug = url.searchParams.get("category");
  const [catalog, categories] = await Promise.all([
    loadCatalog(url, slug && categoryFromSlug(slug) ? slug : undefined, "drops"),
    categoriesService.getAll().then(
      (all) => all.filter((c) => c.productCount > 0),
      () => [],
    ),
  ]);
  return { catalog, categories };
}

export default function BlackFridayPage({ loaderData: { catalog, categories } }: Route.ComponentProps) {
  return (
    <CatalogView
      data={catalog}
      header={
        <div className="space-y-4">
          <BlackFridayHeader total={catalog.meta.total} />
          {categories.length > 0 && <CategoryChips categories={categories} />}
        </div>
      }
    />
  );
}
