import { api } from "../lib/api";
import type { Product, ProductDetail } from "../utils/db-types";

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
  sort?: "price_asc" | "price_desc" | "popularity" | "discount" | "name";
  specs?: Record<string, string | { min?: string; max?: string }>;
}

export interface ProductDrop {
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image_url: string | null;
  category_slug: string;
  product_specs: Record<string, any>;
  current_price: number;
  previous_price: number;
  discount_percentage: number;
  store_name: string;
  store_logo_url: string | null;
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

export const productsService = {
  // Búsqueda rápida optimizada para live search / autocomplete
  quickSearch: (query: string, limit = 10) =>
    api.get<{ data: QuickSearchResult[] }>(`/v1/products/search/quick`, {
      params: { q: query, limit: limit.toString() },
    }),

  // Búsqueda completa para resultados detallados
  search: (query: string, limit = 50, offset = 0) =>
    api.get<Product[]>(`/v1/products/search`, {
      params: { q: query, limit: limit.toString(), offset: offset.toString() },
    }),

  getDrops: (limit = 20, minDiscount = 10) =>
    api.get<ProductDrop[]>(`/v1/products/drops`, {
      params: { limit: limit.toString(), minDiscount: minDiscount.toString() },
    }),

  trackView: (slug: string) => api.post(`/v1/products/${slug}/view`, {}),

  getBySlug: (slug: string) => api.get<ProductDetail>(`/v1/products/${slug}`),

  getAll: (filters: ProductFilters = {}) => {
    const params: Record<string, string> = {};

    if (filters.page) params.page = filters.page.toString();
    if (filters.limit) params.limit = filters.limit.toString();
    if (filters.category) params.category = filters.category;
    if (filters.brand) params.brand = filters.brand;
    if (filters.search) params.search = filters.search;
    if (filters.min_price) params.min_price = filters.min_price.toString();
    if (filters.max_price) params.max_price = filters.max_price.toString();
    if (filters.sort) params.sort = filters.sort;

    if (filters.specs) {
      Object.entries(filters.specs).forEach(([key, value]) => {
        if (typeof value === "object") {
          if (value.min) params[`specs[${key}][min]`] = value.min;
          if (value.max) params[`specs[${key}][max]`] = value.max;
        } else {
          params[`specs[${key}]`] = value;
        }
      });
    }

    return api.get<ProductsResponse>(`/v1/products`, { params });
  },
};
