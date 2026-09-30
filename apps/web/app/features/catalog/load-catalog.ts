import { categoriesService } from "~/features/category/services/categories";
import { productsService } from "~/features/product/services/products";
import { isRateLimitError } from "~/shared/lib/api";

export const CATALOG_SORTS = ["price_asc", "price_desc", "popularity", "name"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

const PAGE_SIZE = 24;

const number = (value: string | null) => (value && Number.isFinite(Number(value)) ? Number(value) : undefined);

/**
 * Datos de la vista de catálogo. La comparten `/explorar` (todo el catálogo, con búsqueda) y
 * `/categoria/:slug` (una categoría): los filtros salen de la URL, así cada vista se puede compartir.
 */
export async function loadCatalog(request: Request, category?: string) {
  const params = new URL(request.url).searchParams;
  const search = params.get("search")?.trim() || undefined;
  const brand = params.get("brand") || undefined;
  const minPrice = number(params.get("min_price"));
  const maxPrice = number(params.get("max_price"));
  const inStock = params.get("in_stock") === "1";
  const sortParam = params.get("sort");
  const sort = CATALOG_SORTS.find((s) => s === sortParam) ?? "price_asc";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const empty = {
    products: [],
    meta: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 },
    brands: [] as Awaited<ReturnType<typeof categoriesService.getBrands>>,
    priceRange: null as Awaited<ReturnType<typeof categoriesService.getPriceRange>> | null,
    trendingIds: [] as string[],
    rateLimited: false,
  };
  const filters = { category: category ?? null, search: search ?? null, brand: brand ?? null, inStock };

  try {
    const [{ data: products, meta }, brands, priceRange, trending] = await Promise.all([
      productsService.getAll({
        page,
        limit: PAGE_SIZE,
        category,
        brand,
        search,
        min_price: minPrice,
        max_price: maxPrice,
        in_stock: inStock,
        sort,
      }),
      category ? categoriesService.getBrands(category).catch(() => empty.brands) : Promise.resolve(empty.brands),
      category ? categoriesService.getPriceRange(category).catch(() => null) : Promise.resolve(null),
      productsService.getTrending(40).catch(() => ({ ids: [] as string[] })),
    ]);
    return { ...empty, ...filters, products, meta, brands, priceRange, trendingIds: trending.ids };
  } catch (error) {
    // Bajo el límite de peticiones la página igual se dibuja, vacía, con un aviso.
    const rateLimited = isRateLimitError(error);
    if (!rateLimited) console.error("Error loading catalog:", error);
    return { ...empty, ...filters, rateLimited };
  }
}

export type CatalogData = Awaited<ReturnType<typeof loadCatalog>>;
