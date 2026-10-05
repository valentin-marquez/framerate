import {
  type CategoryItem,
  categoryFromSlug,
  type Facet,
  facetsFor,
  type ProductSort,
  SpecFilterSchema,
} from "@framerate/contracts";
import { categoriesService } from "~/features/category/services/categories";
import { productsService } from "~/features/product/services/products";
import { isRateLimitError } from "~/shared/lib/api";

export const CATALOG_SORTS = ["price_asc", "price_desc", "popularity", "name", "discount"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number] & ProductSort;

const PAGE_SIZE = 24;

const number = (value: string | null) => (value && Number.isFinite(Number(value)) ? Number(value) : undefined);

/** Facetas de una categoría por su slug; sin categoría no hay. */
export function categoryFacets(category: string | null | undefined) {
  const id = category ? categoryFromSlug(category) : undefined;
  return id ? facetsFor(id) : [];
}

/**
 * Datos de la vista de catálogo. La comparten `/buscar` (todo el catálogo, con búsqueda), `/categoria/:slug` (una
 * categoría) y `/cyber` (`deals`: sólo bajas de precio, de todas las categorías): los filtros salen de la URL, así
 * cada vista se puede compartir.
 */
export async function loadCatalog(request: Request, category?: string, { deals = false } = {}) {
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim() || undefined;
  const brand = params.get("brand") || undefined;
  const minPrice = number(params.get("min_price"));
  const maxPrice = number(params.get("max_price"));
  const defaultSort: CatalogSort = deals ? "discount" : "price_asc";
  const sortParam = params.get("sort");
  const sort = CATALOG_SORTS.find((s) => s === sortParam) ?? defaultSort;
  const page = Math.max(1, Number(params.get("page")) || 1);
  // Una clave ajena a la categoría o un valor mal formado haría fallar la consulta entera (400): se descartan.
  const keys = new Set(categoryFacets(category).map((f) => f.key));
  const spec = params
    .getAll("spec")
    .filter((s) => SpecFilterSchema.safeParse(s).success && keys.has(s.slice(0, s.indexOf(":"))));

  const empty = {
    products: [],
    meta: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 },
    brands: [] as Awaited<ReturnType<typeof categoriesService.getBrands>>,
    priceRange: null as Awaited<ReturnType<typeof categoriesService.getPriceRange>> | null,
    facets: [] as Facet[],
    /** Sólo en `/cyber`, para filtrar por categoría. */
    categories: [] as CategoryItem[],
    trendingIds: [] as number[],
    rateLimited: false,
  };
  const filters = {
    category: category ?? null,
    search: search ?? null,
    brand: brand ?? null,
    spec,
    deals,
    defaultSort,
  };
  const shared = { brand, search, min_price: minPrice, max_price: maxPrice, spec, deals };

  try {
    const [{ items: products, total }, brands, priceRange, facets, categories, trending] = await Promise.all([
      productsService.getAll({ ...shared, page, limit: PAGE_SIZE, category, sort }),
      category
        ? categoriesService.getBrands(category, shared).catch(() => empty.brands)
        : Promise.resolve(empty.brands),
      category ? categoriesService.getPriceRange(category).catch(() => null) : Promise.resolve(null),
      category && keys.size > 0
        ? categoriesService.getFacets(category, shared).catch(() => empty.facets)
        : Promise.resolve(empty.facets),
      deals
        ? categoriesService.getAll().then(
            (all) => all.filter((c) => c.productCount > 0),
            () => empty.categories,
          )
        : Promise.resolve(empty.categories),
      productsService.getTrending(40).catch(() => ({ ids: [] as number[] })),
    ]);
    const meta = { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) };
    return {
      ...empty,
      ...filters,
      products,
      meta,
      brands,
      priceRange,
      facets,
      categories,
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
