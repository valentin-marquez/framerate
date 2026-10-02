import { useQuery } from "@tanstack/react-query";
import { productsService } from "~/features/product/services/products";
import { productKeys } from "~/shared/lib/query-keys";

export function useQuickSearch(query: string, limit = 10) {
  return useQuery({
    queryKey: productKeys.quickSearch(query),
    queryFn: () => productsService.quickSearch(query, limit),
    enabled: query.trim().length >= 2,
    staleTime: 30000,
  });
}
