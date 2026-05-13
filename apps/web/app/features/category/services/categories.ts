import { api } from "~/shared/lib/api";
import type { Category } from "~/shared/utils/db-types";

export type { Category };

export interface CategoryFilter {
  name: string;
  slug: string;
  type: "range" | "select" | "boolean";
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
}

export interface BrandWithCount {
  name: string;
  slug: string;
  count: number;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface CategoryWithCount extends Category {
  product_count?: number;
}

export const categoriesService = {
  getAll: () => api.get<Category[]>("/v1/categories"),

  getFilters: (slug: string) => api.get<Record<string, string[]>>(`/v1/categories/${slug}/filters`),

  getBrands: (slug: string) => api.get<BrandWithCount[]>(`/v1/categories/${slug}/brands`),

  getPriceRange: (slug: string) => api.get<PriceRange>(`/v1/categories/${slug}/price-range`),

  getWithCounts: () => api.get<CategoryWithCount[]>("/v1/categories?with_counts=true"),
};
