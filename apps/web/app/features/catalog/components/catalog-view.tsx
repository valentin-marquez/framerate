import { useLocation, useNavigation, useSearchParams } from "react-router";
import { Pagination, ProductGrid } from "~/features/explore/components";
import { enterClass } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";
import { type CatalogData, categoryFacets } from "../load-catalog";
import { CategoryHeader, SearchHeader } from "./catalog-headers";
import { FilterBar } from "./filter-bar";

/** "memoria", "Wi-Fi", "PCIe": a media frase en minúscula, salvo siglas y nombres con mayúsculas internas. */
const inSentence = (label: string) => (/^.[a-záéíóúñ ]+$/.test(label) ? label.toLowerCase() : label);

/** Datos que les faltan a los "unknown": las facetas filtradas, "memoria o modelo". */
export function missingSpecLabel(category: string | null, spec: string[]) {
  const labels = categoryFacets(category)
    .filter((f) => spec.some((t) => t.startsWith(`${f.key}:`)))
    .map((f) => inSentence(f.label));
  return labels.length ? labels.join(" o ") : undefined;
}

/**
 * Vista de catálogo: cabecera (foto de la categoría o la consulta buscada), barra de filtros fija y grilla
 * paginada. Con `category` es `/categoria/:slug` y sin ella, `/buscar`.
 */
export function CatalogView({ data }: { data: CatalogData }) {
  const { products, meta, brands, priceRange, category, search, trendingIds, rateLimited } = data;
  const [params, setParams] = useSearchParams();
  const loading = useNavigation().state === "loading";
  const trending = new Set(trendingIds);
  // Pasada la carga inicial (que ya tiene su cascada), cada resultado nuevo (búsqueda, filtro, página u otra
  // categoría) entra escalonado: la key vuelve a montar la grilla para repetir la entrada.
  const resultsKey = useLocation().search;
  const fresh = enterClass() === "";

  const goToPage = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {rateLimited && (
        <p className="rounded-2xl border border-border/60 bg-card/70 px-4 py-2 text-center text-muted-foreground text-xs">
          Estamos saturados ahora mismo. Intenta de nuevo en unos segundos.
        </p>
      )}

      {category ? (
        <CategoryHeader
          category={category}
          total={brands.reduce((sum, b) => sum + b.count, 0) || meta.total}
          priceRange={priceRange}
          brandCount={brands.length}
        />
      ) : (
        <SearchHeader total={meta.total} search={search} />
      )}

      <FilterBar
        brands={brands}
        priceRange={priceRange}
        total={meta.total}
        category={category}
        facets={data.facets}
        defaultSort={data.defaultSort}
      />

      <div className={cn("transition-opacity duration-200", loading && "opacity-50")}>
        <ProductGrid
          key={resultsKey}
          products={products}
          trendingIds={trending}
          missingSpec={missingSpecLabel(category, data.spec)}
          className={cn(fresh && "t-results")}
        />
      </div>

      {meta.totalPages > 1 && (
        <Pagination currentPage={meta.page} totalPages={meta.totalPages} onPageChange={goToPage} />
      )}
    </div>
  );
}
