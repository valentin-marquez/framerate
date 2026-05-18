import { Link } from "react-router";
import type { Category } from "~/features/category/services/categories";
import { getCategoryConfig } from "~/features/category/utils/categories";
import { cn } from "~/shared/lib/utils";

interface CompactSearchHeroProps {
  categories: Category[];
}

/**
 * Header compacto y accionable: en vez de un hero de marketing, el usuario
 * aterriza sobre una barra de búsqueda grande (Enter → /explorar?search=) y
 * pills de categoría para saltar directo a navegar productos.
 *
 * El campo de búsqueda real NO vive aquí: es `MorphSearch` (montado en el
 * layout) flotando `position: fixed`. Aquí sólo dejamos un ancla invisible
 * (`#hero-search-anchor`) que reserva su espacio y le dice de dónde partir;
 * al scrollear se interpola de forma continua hasta el ancla del navbar.
 */
export function CompactSearchHero({ categories }: CompactSearchHeroProps) {
  return (
    <section className="flex flex-col items-center gap-6 pt-6 pb-8 md:pt-10 md:pb-10">
      <div className="text-center space-y-2 max-w-2xl">
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-foreground">
          Encuentra tu hardware al <span className="text-primary">mejor precio</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Compara precios de las principales tiendas de Chile en tiempo real.
        </p>
      </div>

      {/* Ancla A: reserva el espacio del buscador grande (alto = HERO_H del
          MorphSearch). El campo real flota encima e interpola desde aquí. */}
      <div id="hero-search-anchor" aria-hidden className="w-full max-w-2xl h-14" />

      {categories.length > 0 && (
        <div className="w-full min-w-0 max-w-full overflow-x-auto md:overflow-x-visible scrollbar-hide">
          <div className="flex items-center gap-2 w-max md:w-full md:flex-wrap md:justify-center">
            {categories.map((category) => {
              const config = getCategoryConfig(category.slug);
              return (
                <Link
                  key={category.id}
                  to={`/categoria/${config.urlSlug}`}
                  prefetch="intent"
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap",
                    "bg-secondary/30 text-secondary-foreground/70 transition-colors duration-200",
                    "hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  {config.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
