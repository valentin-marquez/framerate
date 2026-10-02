import { categoryFromSlug, type PricePoint, type ProductDetail, type ProductPage } from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  search?: string;
  min_price?: number;
  max_price?: number;
  sort?: "price_asc" | "price_desc" | "popularity" | "name";
}

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
  if (filters.sort) params.sort = filters.sort;
  return params;
}

export const productsService = {
  getAll: (filters: ProductFilters = {}) => api.get<ProductPage>("/v1/products", { params: listParams(filters) }),

  // Búsqueda rápida para el buscador (autocompletado).
  quickSearch: async (query: string, limit = 10) => {
    const q = searchable(query);
    if (!q) return [];
    return (await api.get<ProductPage>("/v1/products", { params: { q, pageSize: String(limit) } })).items;
  },

  // Aún no hay ranking de tendencia.
  getTrending: async (_limit?: number): Promise<{ ids: number[] }> => ({ ids: [] }),

  trackView: (slug: string) => api.post(`/v1/products/${slug}/view`, {}),

  getBySlug: (slug: string) => api.get<ProductDetail>(`/v1/products/${slug}`),

  // Si `slug` fue renombrado, devuelve el slug canónico. 404 si no hay redirect.
  resolveRedirect: (slug: string) => api.get<{ slug: string }>(`/v1/products/redirects/${slug}`),

  getPriceHistory: async (slug: string, days = 30) =>
    (await api.get<{ items: PricePoint[] }>(`/v1/products/${slug}/price-history`, { params: { days: String(days) } }))
      .items,
};
