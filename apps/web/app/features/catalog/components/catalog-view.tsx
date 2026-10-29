import { useLocation, useNavigation, useSearchParams } from "react-router";
import { Pagination, ProductGrid } from "~/features/explore/components";
import { WithAd } from "~/shared/components/ad-slot";
import { enterClass } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";
import { type CatalogData, categoryFacets } from "../load-catalog";
import { ActiveChips } from "./active-chips";
import { CategoryHeader, SearchHeader } from "./catalog-headers";
import { CatalogToolbar } from "./catalog-toolbar";
import { FiltersButton } from "./filter-sheet";

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
 * Vista de catálogo: cabecera (la categoría o la consulta buscada), filtros aplicados, barra de orden y
 * paginación fija y grilla paginada. Los filtros de la categoría viven en un panel junto al riel (`CategoryPanel`).
 * Con `category` es `/categoria/:slug` y sin ella, `/buscar`; en las dos, el anuncio va a la derecha de la cabecera.
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

      <WithAd slot={category ? "3200722793" : "8952577073"}>
        {category ? (
          <CategoryHeader
            category={category}
            total={brands.reduce((sum, b) => sum + b.count, 0) || meta.total}
            priceRange={priceRange}
            brandCount={brands.length}
          />
        ) : (
          <SearchHeader total={meta.total} search={search} view={data.view} />
        )}
      </WithAd>

      <div className="flex flex-col gap-3">
        <ActiveChips brands={brands} definitions={categoryFacets(category)} />
        {/* El orden y la paginación van donde están las entradas; los filtros viven en el riel (o en la hoja, en teléfono). */}
        <CatalogToolbar
          total={meta.total}
          page={meta.page}
          totalPages={meta.totalPages}
          pageSize={meta.limit}
          defaultSort={data.defaultSort}
          onPageChange={goToPage}
          lead={category ? <FiltersButton data={data} /> : undefined}
          className="sticky top-14 z-30 -mx-4 border-border/40 border-b bg-background/80 px-4 py-2.5 backdrop-blur-md md:mx-0 md:rounded-2xl md:border md:px-3 lg:top-3"
        />
      </div>

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
