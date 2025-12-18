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

export const categoriesService = {
  getAll: () => api.get<Category[]>("/v1/categories"),

  getFilters: (slug: string) => api.get<CategoryFilter[]>(`/v1/categories/${slug}/filters`),
};
