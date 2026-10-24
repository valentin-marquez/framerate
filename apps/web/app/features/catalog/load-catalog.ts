import { categoryFromSlug, type Facet, facetsFor, type ProductSort, SPEC_FILTER_PATTERN } from "@framerate/contracts";
import { categoriesService } from "~/features/category/services/categories";
import { productsService } from "~/features/product/services/products";
import { isRateLimitError } from "~/shared/lib/api";

export const CATALOG_SORTS = ["price_asc", "price_desc", "popularity", "name", "discount"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number] & ProductSort;

/** Cuántos productos por página se pueden pedir; el primero es el de siempre. */
export const PAGE_SIZES = [24, 12, 48] as const;

const number = (value: string | null) => (value && Number.isFinite(Number(value)) ? Number(value) : undefined);

/** Facetas de una categoría por su slug; sin categoría no hay. */
export function categoryFacets(category: string | null | undefined) {
  const id = category ? categoryFromSlug(category) : undefined;
  return id ? facetsFor(id) : [];
}

/**
 * Datos de la vista de catálogo. La comparten `/buscar` (todo el catálogo, con búsqueda) y `/categoria/:slug` (una
 * categoría): los filtros salen de la URL, así cada vista se puede compartir.
 */
export async function loadCatalog(url: URL, category?: string) {
  const params = url.searchParams;
  const search = params.get("q")?.trim() || undefined;
  const brand = params.getAll("brand").filter(Boolean);
  const minPrice = number(params.get("min_price"));
  const maxPrice = number(params.get("max_price"));
  const defaultSort: CatalogSort = "price_asc";
  const sortParam = params.get("sort");
  const sort = CATALOG_SORTS.find((s) => s === sortParam) ?? defaultSort;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = PAGE_SIZES.find((n) => n === Number(params.get("limit"))) ?? PAGE_SIZES[0];
  // Una clave ajena a la categoría o un valor mal formado haría fallar la consulta entera (400): se descartan.
  const keys = new Set(categoryFacets(category).map((f) => f.key));
  const spec = params.getAll("spec").filter((s) => SPEC_FILTER_PATTERN.test(s) && keys.has(s.slice(0, s.indexOf(":"))));

  const empty = {
    products: [],
    meta: { page: 1, limit: pageSize, total: 0, totalPages: 0 },
    brands: [] as Awaited<ReturnType<typeof categoriesService.getBrands>>,
    priceRange: null as Awaited<ReturnType<typeof categoriesService.getPriceRange>> | null,
    facets: [] as Facet[],
    trendingIds: [] as number[],
    rateLimited: false,
  };
  const filters = {
    category: category ?? null,
    search: search ?? null,
    brand,
    spec,
    defaultSort,
  };
  const shared = { brand, search, min_price: minPrice, max_price: maxPrice, spec };

  try {
    const [{ items: products, total }, brands, priceRange, facets, trending] = await Promise.all([
      productsService.getAll({ ...shared, page, limit: pageSize, category, sort }),
      category
        ? categoriesService.getBrands(category, shared).catch(() => empty.brands)
        : Promise.resolve(empty.brands),
      category ? categoriesService.getPriceRange(category).catch(() => null) : Promise.resolve(null),
      category && keys.size > 0
        ? categoriesService.getFacets(category, shared).catch(() => empty.facets)
        : Promise.resolve(empty.facets),
      productsService.getTrending(40).catch(() => ({ ids: [] as number[] })),
    ]);
    const meta = { page, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) };
    return {
      ...empty,
      ...filters,
      products,
      meta,
      brands,
      priceRange,
      facets,
      trendingIds: trending.ids,
    };
  } catch (error) {
    // Bajo el límite de peticiones la página igual se dibuja, vacía, con un aviso.
    const rateLimited = isRateLimitError(error);
    if (!rateLimited) console.error("Error loading catalog:", error);
    return { ...empty, ...filters, rateLimited };
  }
}

export type CatalogData = Awaited<ReturnType<typeof loadCatalog>>;
