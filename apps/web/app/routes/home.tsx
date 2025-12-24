// En progreso: Implementar la lógica inicial para la ruta de inicio
// TODO: Completar la funcionalidad de la ruta de inicio

import { CardProduct } from "@/components/card-product";
import { CardProductDrop } from "@/components/card-product-drop";
import { HeroSection } from "@/components/hero-section";
import { Carousel, CarouselContent, CarouselItem, CarouselNavigation } from "@/components/primitives/carousel";
import { categoriesService } from "@/services/categories";
import { productsService } from "@/services/products";
import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Framerate" }, { name: "description", content: "Hardware price comparison" }];
}

export async function loader() {
  try {
    const [popularProducts, categories, priceDrops] = await Promise.all([
      productsService.getAll({ limit: 50, sort: "popularity" }),
      categoriesService.getAll(),
      productsService.getDrops(10, 1),
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
  const { popularProducts, priceDrops } = loaderData;

  return (
    <div className="flex flex-col">
      <HeroSection />

      <div className="container mx-auto p-4 space-y-12">
        {priceDrops.length > 0 && (
          <section>
            <Carousel disableDrag>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight">Bajadas de Precio</h2>
                  <span className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    Ofertas
                  </span>
                </div>
                <CarouselNavigation className="static w-auto translate-y-0 gap-2" alwaysShow />
              </div>
              <div className="relative w-full">
                <CarouselContent className="-ml-4">
                  {priceDrops.map((drop) => (
                    <CarouselItem
                      key={`${drop.product_id}-${drop.store_name}`}
                      className="basis-1/2 md:basis-1/3 lg:basis-1/5 pl-4"
                    >
                      <CardProductDrop drop={drop} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </div>
            </Carousel>
          </section>
        )}

        <section>
          <Carousel disableDrag>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold tracking-tight">Lo más visto</h2>
              <CarouselNavigation className="static w-auto translate-y-0 gap-2" alwaysShow />
            </div>
            <div className="relative w-full">
              <CarouselContent className="-ml-4">
                {popularProducts.data.slice(0, 10).map((product) => (
                  <CarouselItem key={product.id} className="basis-1/2 md:basis-1/3 lg:basis-1/5 pl-4">
                    <CardProduct product={product} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </div>
          </Carousel>
        </section>
      </div>
    </div>
  );
}
