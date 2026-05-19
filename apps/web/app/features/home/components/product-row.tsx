import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "react-router";
import { ProductCardCompact } from "~/features/product/components/card-product-compact";
import type { Product } from "~/features/product/services/products";
import { Carousel, CarouselContent, CarouselItem, CarouselNavigation } from "~/shared/components/primitives/carousel";

interface ProductRowProps {
  title: string;
  /** Destino del enlace "Ver todos" (ej: /explorar?category=...). */
  href: string;
  products: Product[];
  /** La primera fila visible carga sus imágenes con prioridad (LCP). */
  priority?: boolean;
  /** Ids en tendencia para el badge. La fila "Lo más popular" no lo pasa
   *  (ahí todo sería tendencia → ruido). */
  trendingIds?: Set<string>;
}

/**
 * Fila temática horizontal estilo Airbnb: header slim (título + "Ver todos")
 * y un carrusel de cards compactas. Reutilizable para Ofertas, Lo más popular
 * y cada categoría en la home.
 */
export function ProductRow({ title, href, products, priority = false, trendingIds }: ProductRowProps) {
  if (products.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <Link to={href} prefetch="intent" className="group inline-flex items-baseline gap-2 min-w-0">
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
            {title}
          </h2>
          <IconArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>

        <Link
          to={href}
          prefetch="intent"
          className="shrink-0 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          Ver todos
        </Link>
      </div>

      <div className="relative">
        <Carousel className="w-full">
          <CarouselContent className="-ml-3">
            {products.map((product, index) => (
              <CarouselItem
                key={product.id}
                className="pl-3 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
              >
                <ProductCardCompact
                  product={product}
                  priority={priority && index < 6}
                  trending={product.id ? trendingIds?.has(product.id) : false}
                  className="h-full"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselNavigation
            className="absolute left-1 right-1 w-auto top-1/2 -translate-y-1/2 flex justify-between pointer-events-none"
            classNameButton="pointer-events-auto shadow-lg size-9"
          />
        </Carousel>
      </div>
    </section>
  );
}
