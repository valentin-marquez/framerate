import { useProductDrops, useProducts } from "@/hooks/useProducts";
import { categoriesService } from "@/services/categories";
import { productsService } from "@/services/products";
import { ProductCard } from "~/components/product/card-product";
import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Framerate" }, { name: "description", content: "Hardware price comparison" }];
}

export async function loader() {
  try {
    const [popularProducts, categories, priceDrops] = await Promise.all([
      productsService.getAll({ limit: 400, sort: "popularity" }),
      categoriesService.getAll(),
      productsService.getDrops(24, 2), // 12 productos con mínimo 5% descuento
    ]);
    return { popularProducts, categories, priceDrops };
  } catch (error) {
    console.error("Failed to fetch data", error);
    return {
      popularProducts: {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
      categories: [],
      priceDrops: [],
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { popularProducts: initialPopular, priceDrops: initialDrops } = loaderData;

  const { data: popularProducts } = useProducts({ limit: 400, sort: "popularity" }, { initialData: initialPopular });

  const { data: priceDrops } = useProductDrops(24, 2, { initialData: initialDrops });

  // Fallback to initial data if hook returns undefined (shouldn't happen with initialData)
  const products = popularProducts ?? initialPopular;
  const drops = priceDrops ?? initialDrops;

  return (
    <div className="flex flex-col min-h-screen gap-16 md:gap-24 pb-20">
      {/* Popular Products Section */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold font-sans text-primary">Productos populares</h2>
            <p className="text-sm text-muted-foreground mt-1">Los productos más vistos por la comunidad</p>
          </div>
          {products.meta.total > products.data.length && (
            <a
              href="/productos"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Ver todos →
            </a>
          )}
        </div>

        {products.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5  gap-4">
            {products.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">No hay productos disponibles</p>
          </div>
        )}
      </section>

      {/* Price Drops Section */}
      {drops.length > 0 && (
        <section className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold font-sans text-primary">Ofertas recientes</h2>
              <p className="text-sm text-muted-foreground mt-1">Productos con bajadas de precio</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5  gap-4">
            {drops.map((drop) => {
              // Convertir drop a formato Product para ProductCard
              const product = {
                id: drop.product_id,
                name: drop.product_name,
                slug: drop.product_slug,
                image_url: drop.product_image_url,
                brand: null,
                category: { name: "", slug: drop.category_slug },
                specs: drop.product_specs,
                prices: {
                  cash: drop.current_price,
                  normal: drop.previous_price,
                },
                popularity_score: 0,
              };
              return <ProductCard key={drop.product_id} product={product} />;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
