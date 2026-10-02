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

export function usePriceHistory(slug: string, days = 30) {
  return useQuery({
    queryKey: productKeys.priceHistory(slug, days),
    queryFn: () => productsService.getPriceHistory(slug, days),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}
