import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { type Category, categoriesService } from "@/services/categories";

export const CATEGORIES_QUERY_KEY = ["categories"];

export function useCategories(options?: Partial<UseQueryOptions<Category[]>>) {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: categoriesService.getAll,
    ...options,
  });
}

export function useCategoryFilters(slug?: string) {
  return useQuery({
    queryKey: ["categories", slug, "filters"],
    queryFn: () => (slug ? categoriesService.getFilters(slug) : Promise.resolve([])),
    enabled: !!slug,
  });
}
