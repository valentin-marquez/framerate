import type { BrandCount, CategoryItem, FacetList, PriceRange } from "@framerate/contracts";
import { listParams, type ProductFilters } from "~/features/product/services/products";
import { api } from "~/shared/lib/api";

export const categoriesService = {
  getAll: async () => (await api.get<{ items: CategoryItem[] }>("/v1/categories")).items,

  getBrands: async (slug: string) => (await api.get<{ items: BrandCount[] }>(`/v1/categories/${slug}/brands`)).items,

  getPriceRange: (slug: string) => api.get<PriceRange>(`/v1/categories/${slug}/price-range`),

  /** Valores de cada faceta con su conteo, con los mismos filtros del listado (la categoría va en la ruta). */
  getFacets: async (slug: string, filters: Omit<ProductFilters, "category" | "page" | "limit" | "sort">) =>
    (await api.get<FacetList>(`/v1/categories/${slug}/facets`, { params: listParams(filters) })).items,
};
