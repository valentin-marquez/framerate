import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { type Category, categoriesService } from "~/features/category/services/categories";
import { categoryKeys } from "~/shared/lib/query-keys";

export function useCategories(
  options?: Omit<UseQueryOptions<Category[], Error, Category[], readonly string[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: categoriesService.getAll,
    ...options,
  });
}

export function useCategoryFilters(slug?: string) {
  return useQuery({
    queryKey: categoryKeys.filters(slug ?? ""),
    queryFn: () => (slug ? categoriesService.getFilters(slug) : Promise.resolve({} as Record<string, string[]>)),
    enabled: !!slug,
  });
}
