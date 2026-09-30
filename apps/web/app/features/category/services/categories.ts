import type { PriceRange as ApiPriceRange, BrandCount, CategoryItem } from "@framerate/contracts";
import { toCategory } from "~/features/product/services/adapters";
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
  getAll: async (): Promise<CategoryWithCount[]> =>
    (await api.get<{ items: CategoryItem[] }>("/v1/categories")).items.map(toCategory),

  // Los filtros por especificación aún no existen en la API nueva.
  getFilters: async (_slug: string): Promise<Record<string, string[]>> => ({}),

  getBrands: async (slug: string): Promise<BrandWithCount[]> =>
    (await api.get<{ items: BrandCount[] }>(`/v1/categories/${slug}/brands`)).items,

  getPriceRange: async (slug: string): Promise<PriceRange> => {
    const range = await api.get<ApiPriceRange>(`/v1/categories/${slug}/price-range`);
    return { min: range.min ?? 0, max: range.max ?? 0 };
  },

  getWithCounts: async (): Promise<CategoryWithCount[]> =>
    (await api.get<{ items: CategoryItem[] }>("/v1/categories")).items.map(toCategory),
};
