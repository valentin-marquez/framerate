import {
  type ProductDetail as ApiProductDetail,
  categoryFromSlug,
  type PricePoint,
  type ProductPage,
} from "@framerate/contracts";
import { api } from "~/shared/lib/api";
import type { Product, ProductDetail, ProductSpecs } from "~/shared/utils/db-types";
import { toPriceHistory, toProduct, toProductDetail, toQuickResult } from "./adapters";

export type { Product, ProductDetail };

export interface ProductsResponse {
  data: Product[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  search?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  sort?: "price_asc" | "price_desc" | "popularity" | "discount" | "name";
  specs?: Record<string, string | string[] | { min?: string; max?: string }>;
}

export interface ProductDrop {
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image_url: string | null;
  category_slug: string;
  product_specs: ProductSpecs;
  current_price: number;
  previous_price: number;
  discount_percentage: number;
  store_name: string;
  store_logo_url: string | null;
}

export interface PriceHistoryPoint {
  recorded_at: string;
  price_cash: number;
  price_normal: number;
}

export interface PriceHistorySeries {
  store_slug: string;
  store_name: string;
  store_logo_url: string | null;
  points: PriceHistoryPoint[];
}

export interface PriceHistoryResponse {
  days: number;
  series: PriceHistorySeries[];
}

export interface QuickSearchResult {
  id: string;
  name: string;
  slug: string;
  brand_name: string;
  category_name: string;
  current_price: number;
  image_url: string | null;
  rank: number;
}

const SORTS: Record<NonNullable<ProductFilters["sort"]>, string> = {
  price_asc: "price_asc",
  price_desc: "price_desc",
  popularity: "popularity",
  name: "name",
  // Sin precio de referencia todavía: mientras tanto se ordena por relevancia.
  discount: "relevance",
};

/** La API no acepta búsquedas de menos de 2 caracteres. */
const searchable = (q: string | undefined) => (q && q.trim().length >= 2 ? q.trim() : undefined);

function listParams(filters: ProductFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.page) params.page = String(filters.page);
  if (filters.limit) params.pageSize = String(filters.limit);
  if (filters.category) params.category = categoryFromSlug(filters.category) ?? filters.category;
  if (filters.brand) params.brand = filters.brand;
  const q = searchable(filters.search);
  if (q) params.q = q;
  if (filters.min_price) params.minPrice = String(filters.min_price);
  if (filters.max_price) params.maxPrice = String(filters.max_price);
  if (filters.in_stock) params.inStock = "true";
  if (filters.sort) params.sort = SORTS[filters.sort];
  return params;
}

async function fetchList(filters: ProductFilters): Promise<ProductsResponse> {
  const page = await api.get<ProductPage>("/v1/products", { params: listParams(filters) });
  return {
    data: page.items.map(toProduct),
    meta: {
      page: page.page,
      limit: page.pageSize,
      total: page.total,
      totalPages: Math.ceil(page.total / page.pageSize),
    },
  };
}

export const productsService = {
  // Búsqueda rápida optimizada para live search / autocomplete
  quickSearch: async (query: string, limit = 10) => {
    const q = searchable(query);
    if (!q) return { data: [] as QuickSearchResult[] };
    const page = await api.get<ProductPage>("/v1/products", { params: { q, pageSize: String(limit) } });
    return { data: page.items.map(toQuickResult) };
  },

  // Búsqueda completa para resultados detallados
  search: async (query: string, limit = 50, offset = 0): Promise<Product[]> => {
    const { data } = await fetchList({ search: query, limit, page: Math.floor(offset / limit) + 1 });
    return data;
  },

  // Aún no hay precio de referencia, así que no hay bajas de precio que mostrar.
  getDrops: async (_limit?: number, _minDiscount?: number): Promise<ProductDrop[]> => [],

  // Aún no hay ranking de tendencia.
  getTrending: async (_limit?: number): Promise<{ ids: string[] }> => ({ ids: [] }),

  trackView: (slug: string) => api.post(`/v1/products/${slug}/view`, {}),

  getBySlug: async (slug: string): Promise<ProductDetail> =>
    toProductDetail(await api.get<ApiProductDetail>(`/v1/products/${slug}`)),

  // Si `slug` fue renombrado, devuelve el slug canónico. 404 si no hay redirect.
  resolveRedirect: (slug: string) => api.get<{ slug: string }>(`/v1/products/redirects/${slug}`),

  getPriceHistory: async (slug: string, days = 30): Promise<PriceHistoryResponse> => {
    const { items } = await api.get<{ items: PricePoint[] }>(`/v1/products/${slug}/price-history`, {
      params: { days: String(days) },
    });
    return toPriceHistory(items, days);
  },

  getAll: (filters: ProductFilters = {}) => fetchList(filters),
};
