import type { CategoryItem } from "@framerate/contracts";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { categoriesService } from "~/features/category/services/categories";
import { categoryKeys } from "~/shared/lib/query-keys";

export function useCategories(
  options?: Omit<UseQueryOptions<CategoryItem[], Error, CategoryItem[], readonly string[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: categoriesService.getAll,
    ...options,
  });
}
