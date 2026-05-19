import { IconArrowRight, IconFilter, IconSearch, IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { categoriesService } from "~/features/category/services/categories";
import { getCategoryConfig } from "~/features/category/utils/categories";
import {
  ActiveFilters,
  CategorySelector,
  FilterSidebar,
  Pagination,
  PriceRangeQuickFilters,
  ProductGrid,
  ResultsSummary,
  SortSelector,
} from "~/features/explore/components";
import { productsService } from "~/features/product/services/products";
import { Button } from "~/shared/components/primitives/button";
import { isRateLimitError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { getFiltersForCategory } from "~/shared/utils/filter-config";
import type { Route } from "./+types/explore-page";

export function meta({ data }: Route.MetaArgs) {
  const categoryLabel = data?.currentCategory ? getCategoryConfig(data.currentCategory).label : "Todos los productos";

  return [
    { title: `Explorar ${categoryLabel} - Precios y Ofertas | Framerate` },
    {
      name: "description",
      content: `Explora y compara ${categoryLabel.toLowerCase()} con los mejores precios en Chile. Filtra por especificaciones, marca y precio.`,
    },
    { property: "og:title", content: `Explorar ${categoryLabel} | Framerate` },
    {
      property: "og:description",
      content: `Encuentra las mejores ofertas de ${categoryLabel.toLowerCase()} en Chile.`,
    },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "es_CL" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Extract query params
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 24;
  const category = searchParams.get("category") || undefined;
  const brand = searchParams.get("brand") || undefined;
  const search = searchParams.get("search") || undefined;
  const minPrice = searchParams.get("min_price") ? Number(searchParams.get("min_price")) : undefined;
  const maxPrice = searchParams.get("max_price") ? Number(searchParams.get("max_price")) : undefined;
  const sort =
    (searchParams.get("sort") as "price_asc" | "price_desc" | "popularity" | "discount" | "name") || "price_asc";

  // Build specs filters from query params (supports multi-select)
  const specs: Record<string, string | string[] | { min?: string; max?: string }> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("specs[")) {
      const match = key.match(/specs\[(.*?)\](?:\[(.*?)\])?/);
      if (match) {
        const specKey = match[1];
        const subKey = match[2];

        if (subKey) {
          const existing = specs[specKey];
          if (!existing || typeof existing === "string" || Array.isArray(existing)) {
            specs[specKey] = {};
          }
          (specs[specKey] as { min?: string; max?: string })[subKey as "min" | "max"] = value;
        } else {
          // Multi-select support: accumulate values in an array
          const existing = specs[specKey];
          if (Array.isArray(existing)) {
            existing.push(value);
          } else if (typeof existing === "string") {
            specs[specKey] = [existing, value];
          } else {
            specs[specKey] = value;
          }
        }
      }
    }
  }

  try {
    // Fetch products + category-specific data + trending ids in parallel
    const [productsResponse, filters, brands, priceRange, trending] = await Promise.all([
      productsService.getAll({
        page,
        limit,
        category,
        brand,
        search,
        min_price: minPrice,
        max_price: maxPrice,
        sort,
        specs: Object.keys(specs).length > 0 ? specs : undefined,
      }),
      // Get static filter config + dynamic options
      category
        ? (async () => {
            const staticFilters = getFiltersForCategory(category);
            try {
              const dynamicOptions = await categoriesService.getFilters(category);
              if (dynamicOptions && typeof dynamicOptions === "object" && !Array.isArray(dynamicOptions)) {
                return staticFilters.map((filter) => {
                  if (filter.type === "select" && dynamicOptions[filter.slug]) {
                    return { ...filter, options: dynamicOptions[filter.slug] };
                  }
                  return filter;
                });
              }
            } catch (e) {
              console.error("Error fetching category filters:", e);
            }
            return staticFilters;
          })()
        : Promise.resolve([]),
      // Fetch brands for category
      category ? categoriesService.getBrands(category).catch(() => []) : Promise.resolve([]),
      // Fetch price range for category
      category ? categoriesService.getPriceRange(category).catch(() => null) : Promise.resolve(null),
      // Ranking de tendencia (cacheado en el edge) para el badge en los cards
      productsService
        .getTrending(40)
        .catch(() => ({ ids: [] as string[] })),
    ]);

    const { data: products, meta } = productsResponse;

    return {
      products: products || [],
      meta: meta || { page: 1, limit: 24, total: 0, totalPages: 0 },
      filters,
      brands,
      priceRange,
      currentCategory: category || null,
      currentSearch: search || null,
      currentBrand: brand || null,
      trendingIds: trending.ids,
      rateLimited: false,
    };
  } catch (error) {
    // Bajo rate limit, degradamos a estado vacío para que la página renderice
    // con skeletons / empty state en lugar de tirar al error boundary. El
    // cliente revalida en el siguiente navigation/focus.
    const rateLimited = isRateLimitError(error);
    if (!rateLimited) {
      console.error("Error loading explore page:", error);
    }
    return {
      products: [],
      meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
      filters: [],
      brands: [],
      priceRange: null,
      currentCategory: category || null,
      currentSearch: search || null,
      currentBrand: brand || null,
      trendingIds: [] as string[],
      rateLimited,
    };
  }
}

export default function ExplorePage({ loaderData }: Route.ComponentProps) {
  const {
    products,
    meta,
    filters,
    brands,
    priceRange,
    currentCategory,
    currentSearch,
    currentBrand,
    trendingIds,
    rateLimited,
  } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(currentSearch || "");

  const trendingSet = new Set(trendingIds);
  const hasFilters = filters.length > 0 || brands.length > 0;
  const categoryLabel = currentCategory ? getCategoryConfig(currentCategory).label : "Todos los productos";

  const handlePageChange = useCallback(
    (page: number) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("page", page.toString());
      setSearchParams(newParams);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [searchParams, setSearchParams],
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const newParams = new URLSearchParams(searchParams);
      if (searchInput.trim()) {
        newParams.set("search", searchInput.trim());
      } else {
        newParams.delete("search");
      }
      newParams.set("page", "1");
      setSearchParams(newParams);
    },
    [searchInput, searchParams, setSearchParams],
  );

  const clearSearch = useCallback(() => {
    setSearchInput("");
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("search");
    newParams.set("page", "1");
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  return (
    <div className="flex flex-col gap-6">
      {/* Banner suave de saturación: sólo cuando el loader degradó por 429. */}
      {rateLimited && (
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-md px-4 py-2 text-center text-xs text-muted-foreground">
          Estamos saturados ahora mismo. Intenta de nuevo en unos segundos.
        </div>
      )}

      {/* Encabezado compacto, alineado al estilo del home */}
      <header className="flex flex-col gap-5 pt-1">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{categoryLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {meta.total > 0 ? (
              <>
                <span className="font-medium text-foreground">{meta.total.toLocaleString("es-CL")}</span> productos ·
                compara precios de tiendas en Chile
              </>
            ) : (
              "Compara precios de hardware de las principales tiendas de Chile"
            )}
          </p>
        </div>

        {/* Buscador grande, con la misma estética del campo morph del home */}
        <form onSubmit={handleSearch} className="relative w-full max-w-2xl">
          <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="¿Qué componente buscas? Ej: RTX 4070, Ryzen 7…"
            aria-label="Buscar productos"
            className={cn(
              "h-12 w-full rounded-xl bg-card border border-border/60 shadow-sm",
              "pl-12 pr-24 text-[15px] text-secondary-foreground placeholder:text-muted-foreground",
              "outline-none transition-colors focus:border-primary",
            )}
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpiar búsqueda"
              className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <IconX className="size-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Buscar"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-8 rounded-lg bg-secondary/40 text-secondary-foreground/70 transition-colors duration-200 hover:bg-primary hover:text-primary-foreground"
          >
            <IconArrowRight className="size-4" />
          </button>
        </form>

        {/* Pills de categoría */}
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <CategorySelector currentCategory={currentCategory} />
        </div>
      </header>

      {/* Barra flotante (glass) con resumen + controles. Sticky bajo el navbar. */}
      <div className="sticky top-13 z-30 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/80 px-4 py-2.5 backdrop-blur-md">
        <ResultsSummary total={meta.total} currentPage={meta.page} limit={meta.limit} />
        <div className="flex items-center gap-2 shrink-0">
          <PriceRangeQuickFilters priceRange={priceRange} className="hidden md:flex" />
          <SortSelector />
          {hasFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsMobileFiltersOpen(true)}
              className="lg:hidden gap-1.5"
            >
              <IconFilter className="size-4" />
              <span>Filtros</span>
            </Button>
          )}
        </div>
      </div>

      <ActiveFilters />

      {/* Cuerpo: sidebar de filtros sólo cuando hay filtros (sin columna vacía) */}
      <div className="flex gap-6">
        {hasFilters && (
          <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card">
              <FilterSidebar filters={filters} brands={brands} currentBrand={currentBrand} />
            </div>
          </aside>
        )}

        {/* Drawer móvil (glass) */}
        {hasFilters && (
          <FilterSidebar
            filters={filters}
            brands={brands}
            currentBrand={currentBrand}
            isMobileOpen={isMobileFiltersOpen}
            onMobileClose={() => setIsMobileFiltersOpen(false)}
            className="lg:hidden"
          />
        )}

        <main className="flex-1 min-w-0">
          <ProductGrid products={products} trendingIds={trendingSet} />

          {meta.totalPages > 1 && (
            <div className="mt-10">
              <Pagination currentPage={meta.page} totalPages={meta.totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
