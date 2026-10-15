import type { ProductSummary } from "@framerate/contracts";
import { Link } from "react-router";
import { ProductCard } from "~/features/product/components/product-card";
import { Carousel, CarouselContent, CarouselItem, CarouselNavigation } from "~/shared/components/primitives/carousel";
import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";

interface ProductRowProps {
  title: string;
  /** Destino del enlace "Ver todos" (ej: /categoria/tarjetas-de-video). */
  href: string;
  /** Texto del enlace a la lista completa. */
  more?: string;
  products: ProductSummary[];
  /** Fila en el primer pliegue: su primera foto carga con prioridad (LCP) y entra en cascada al cargar la página. */
  priority?: boolean;
  /** Ids en tendencia para el badge. La fila "Lo más popular" no lo pasa
   *  (ahí todo sería tendencia → ruido). */
  trendingIds?: Set<number>;
}

/**
 * Fila temática horizontal estilo Airbnb: header slim (título + "Ver todos")
 * y un carrusel de cards compactas. Reutilizable para Lo más popular
 * y cada categoría en la home.
 */
export function ProductRow({
  title,
  href,
  more = "Ver todos",
  products,
  priority = false,
  trendingIds,
}: ProductRowProps) {
  if (products.length === 0) return null;

  return (
    // Las filas bajo el pliegue no pagan estilo, layout ni pintura hasta acercarse a la pantalla.
    <section className={cn("space-y-3", !priority && "[contain-intrinsic-size:auto_245px] [content-visibility:auto]")}>
      <div className="flex items-end justify-between gap-4">
        <Link to={href} prefetch="intent" className="group inline-flex items-baseline gap-2 min-w-0">
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
            {title}
          </h2>
        </Link>

        <Link
          to={href}
          prefetch="intent"
          className="shrink-0 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          {more}
        </Link>
      </div>

      <div className="relative">
        <Carousel className="w-full">
          <CarouselContent className="-ml-3">
            {products.map((product, index) => (
              <CarouselItem key={product.id} className="basis-[88%] pl-3 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <div
                  className={cn("h-full", priority && index < 4 && enterClass())}
                  style={priority && index < 4 ? enterStyle(260 + index * 50) : undefined}
                >
                  <ProductCard
                    product={product}
                    priority={priority && index === 0}
                    trending={trendingIds?.has(product.id)}
                    className="h-full"
                  />
                </div>
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
