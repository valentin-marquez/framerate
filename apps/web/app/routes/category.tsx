import { getApiSlugFromUrl, getCategoryConfig } from "../utils/categories";
import type { Route } from "./+types/category";

export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;
  const apiSlug = getApiSlugFromUrl(slug);

  if (!apiSlug) {
    throw new Response("Category not found", { status: 404 });
  }

  // Obtener datos de la categoría usando apiSlug
  // Por ahora, solo devolvemos los slugs para verificar que funciona
  return {
    slug,
    apiSlug,
    config: getCategoryConfig(apiSlug),
  };
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { config } = loaderData;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{config.label}</h1>
      <p>Showing products for {config.label}...</p>
    </div>
  );
}
