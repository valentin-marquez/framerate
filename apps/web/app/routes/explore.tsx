"use client";

import { IconFilter, IconSearch, IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import {
  ActiveFilters,
  CategorySelector,
  FilterSidebar,
  Pagination,
  PriceRangeQuickFilters,
  ProductGrid,
  ResultsSummary,
  SortSelector,
} from "~/components/explore";
import { Button } from "~/components/primitives/button";
import { Input } from "~/components/primitives/input";
import { categoriesService } from "~/services/categories";
import { productsService } from "~/services/products";
import { getCategoryConfig } from "~/utils/categories";
import { getFiltersForCategory } from "~/utils/filter-config";
import type { Route } from "./+types/explore";

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
  const inStock = searchParams.get("in_stock") === "true";

  // Build specs filters from query params
  const specs: Record<string, string | { min?: string; max?: string }> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("specs[")) {
      const match = key.match(/specs\[(.*?)\](?:\[(.*?)\])?/);
      if (match) {
        const specKey = match[1];
        const subKey = match[2];

        if (subKey) {
          if (!specs[specKey] || typeof specs[specKey] === "string") {
            specs[specKey] = {};
          }
          (specs[specKey] as { min?: string; max?: string })[subKey as "min" | "max"] = value;
        } else {
          specs[specKey] = value;
        }
      }
    }
  }

  try {
    // Fetch products with filters
    const { data: products, meta } = await productsService.getAll({
      page,
      limit,
      category,
      brand,
      search,
      min_price: minPrice,
      max_price: maxPrice,
      sort,
      specs: Object.keys(specs).length > 0 ? specs : undefined,
    });

    // Get filters for the selected category
    const filters = category ? getFiltersForCategory(category) : [];

    // Get dynamic filter options from API if category is selected
    let dynamicFilterOptions: Record<string, string[]> = {};
    if (category) {
      try {
        const apiFilters = await categoriesService.getFilters(category);
        if (apiFilters && typeof apiFilters === "object" && !Array.isArray(apiFilters)) {
          dynamicFilterOptions = apiFilters;
        }
      } catch (e) {
        console.error("Error fetching category filters:", e);
      }
    }

    // Merge static filter config with dynamic options
    const enrichedFilters = filters.map((filter) => {
      if (filter.type === "select" && dynamicFilterOptions[filter.slug]) {
        return {
          ...filter,
          options: dynamicFilterOptions[filter.slug],
        };
      }
      return filter;
    });

    return {
      products,
      meta,
      filters: enrichedFilters,
      currentCategory: category || null,
      currentSearch: search || null,
      inStock,
    };
  } catch (error) {
    console.error("Error loading explore page:", error);
    return {
      products: [],
      meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
      filters: [],
      currentCategory: category || null,
      currentSearch: search || null,
      inStock: false,
    };
  }
}

export default function ExplorePage({ loaderData }: Route.ComponentProps) {
  const { products, meta, filters, currentCategory, currentSearch } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(currentSearch || "");

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
    // Margen negativo para escapar del container del root.tsx
    <div className="-mx-4 -mt-11">
      {/* Header section - sticky bajo el navbar */}
      <div className="sticky top-13 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-4">
          {/* Primera fila: Título + botón filtros móvil */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Explorar</h1>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsMobileFiltersOpen(true)}
              className="lg:hidden gap-1.5"
            >
              <IconFilter className="h-4 w-4" />
              <span>Filtros</span>
            </Button>
          </div>

          {/* Category pills - scroll horizontal en móvil */}
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-2 scrollbar-hide">
            <CategorySelector currentCategory={currentCategory} />
          </div>

          {/* Barra de búsqueda y controles */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
            <form onSubmit={handleSearch} className="flex-1 max-w-sm relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Buscar productos..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <IconX className="h-4 w-4" />
                </button>
              )}
            </form>

            <div className="flex items-center gap-3 shrink-0">
              <PriceRangeQuickFilters className="hidden md:flex" />
              <SortSelector />
            </div>
          </div>

          {/* Active filters */}
          <ActiveFilters className="mt-3" />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-h-[calc(100vh-200px)]">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 border-r border-border bg-card/30">
          <div className="sticky top-54 h-[calc(100vh-13.5rem)] w-full overflow-hidden">
            <FilterSidebar filters={filters} />
          </div>
        </aside>

        {/* Mobile sidebar */}
        <FilterSidebar
          filters={filters}
          isMobileOpen={isMobileFiltersOpen}
          onMobileClose={() => setIsMobileFiltersOpen(false)}
          className="lg:hidden"
        />

        {/* Products grid area */}
        <main className="flex-1 min-w-0">
          <div className="px-4 lg:px-6 py-6">
            {/* Results summary */}
            <div className="flex items-center justify-between mb-6">
              <ResultsSummary total={meta.total} currentPage={meta.page} limit={meta.limit} />
            </div>

            {/* Grid */}
            <ProductGrid products={products} />

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="mt-10 pb-6">
                <Pagination currentPage={meta.page} totalPages={meta.totalPages} onPageChange={handlePageChange} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
