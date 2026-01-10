import { api } from "../lib/api";
import type { Category } from "../utils/db-types";

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

export interface CategoryWithCount extends Category {
  product_count?: number;
}

export const categoriesService = {
  getAll: () => api.get<Category[]>("/v1/categories"),

  getFilters: (slug: string) => api.get<Record<string, string[]>>(`/v1/categories/${slug}/filters`),

  getWithCounts: () => api.get<CategoryWithCount[]>("/v1/categories?with_counts=true"),
};
