import type { BrandCount, CategoryItem, PriceRange } from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export const categoriesService = {
  getAll: async () => (await api.get<{ items: CategoryItem[] }>("/v1/categories")).items,

  getBrands: async (slug: string) => (await api.get<{ items: BrandCount[] }>(`/v1/categories/${slug}/brands`)).items,

  getPriceRange: (slug: string) => api.get<PriceRange>(`/v1/categories/${slug}/price-range`),
};
