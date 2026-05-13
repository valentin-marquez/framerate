import { ProductCard } from "~/features/product/components/card-product";
import { productsService } from "~/features/product/services/products";
import { getApiSlugFromUrl, getCategoryConfig } from "../utils/categories";
import type { Route } from "./+types/category-page";

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Categoría no encontrada | Framerate" }];
  const { config } = data;
  return [
    { title: `${config.label} - Precios y Ofertas en Chile | Framerate` },
    {
      name: "description",
      content: `Catálogo de ${config.label} con los precios más bajos de tiendas chilenas. Compara especificaciones, stock y ofertas de ${config.label} en Framerate.`,
    },
    { property: "og:title", content: `${config.label} - Precios en Chile` },
    { property: "og:description", content: `Encuentra las mejores ofertas de ${config.label} en Chile.` },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "es_CL" },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const { slug } = params;
  const apiSlug = getApiSlugFromUrl(slug);

  if (!apiSlug) {
    throw new Response("Category not found", { status: 404 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;

  try {
    const { data: products, meta } = await productsService.getAll({
      category: apiSlug,
      page,
      limit: 24,
    });

    return {
      slug,
      apiSlug,
      config: getCategoryConfig(apiSlug),
      products,
      meta,
    };
  } catch (error) {
    console.error("Error fetching products:", error);
    throw new Response("Error loading products", { status: 500 });
  }
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { config, products, meta } = loaderData;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{config.label}</h1>
          <p className="text-muted-foreground">
            Mostrando {products.length} productos de {meta.total}
          </p>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">No se encontraron productos en esta categoría.</p>
          </div>
        )}
      </div>
    </div>
  );
}
