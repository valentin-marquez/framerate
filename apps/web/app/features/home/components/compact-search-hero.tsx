import type { CategoryItem } from "@framerate/contracts";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { SiteSearch } from "~/shared/components/layout/site-search";
import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";

interface CompactSearchHeroProps {
  categories: CategoryItem[];
}

/**
 * Header compacto y accionable: en vez de un hero de marketing, el usuario
 * aterriza sobre una barra de búsqueda grande (Enter → /explorar?search=) y
 * pills de categoría para saltar directo a navegar productos.
 */
export function CompactSearchHero({ categories }: CompactSearchHeroProps) {
  const searchRef = useRef<HTMLDivElement>(null);

  // Cuando el campo pasa bajo el navbar (h-13, 52 px) lo reemplaza el del navbar: `data-search-docked` en <html> activa
  // las reglas `.nav-search` de app.css. Un solo observer; nada de leer layout en cada scroll.
  useEffect(() => {
    const field = searchRef.current;
    if (!field) return;
    const root = document.documentElement;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const docked = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
        if (docked === root.hasAttribute("data-search-docked")) return;
        root.toggleAttribute("data-search-docked", docked);
        // Lo escrito y el foco pasan al campo que queda a la vista.
        const hero = document.getElementById("hero-search") as HTMLInputElement | null;
        const nav = document.getElementById("nav-search") as HTMLInputElement | null;
        if (!hero || !nav) return;
        const [from, to] = docked ? [hero, nav] : [nav, hero];
        to.value = from.value;
        if (document.activeElement === from) to.focus({ preventScroll: true });
      },
      { rootMargin: "-52px 0px 0px 0px", threshold: 1 },
    );
    observer.observe(field);
    return () => {
      observer.disconnect();
      root.removeAttribute("data-search-docked");
    };
  }, []);

  return (
    <section className="flex flex-col items-center gap-6 pt-6 pb-8 md:pt-10 md:pb-10">
      <div className={cn("text-center space-y-2 max-w-2xl", enterClass())}>
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-foreground">
          Encuentra tu hardware al <span className="text-primary">mejor precio</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Precios de tiendas de Chile, actualizados cada 6 horas.
        </p>
      </div>

      <div ref={searchRef} className={cn("w-full max-w-2xl", enterClass())} style={enterStyle(80)}>
        <SiteSearch id="hero-search" className="h-14 rounded-2xl" />
      </div>

      {categories.length > 0 && (
        <div
          className={cn("w-full min-w-0 max-w-full overflow-x-auto md:overflow-x-visible scrollbar-hide", enterClass())}
          style={enterStyle(160)}
        >
          <div className="flex items-center gap-2 w-max md:w-full md:flex-wrap md:justify-center">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/categoria/${category.slug}`}
                prefetch="intent"
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap",
                  "bg-secondary/30 text-secondary-foreground/70 transition-colors duration-200",
                  "hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {category.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
