import { keepPreviousData, type UseQueryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type PriceHistoryResponse,
  type ProductDrop,
  type ProductFilters,
  type ProductsResponse,
  productsService,
} from "~/features/product/services/products";
import { productKeys } from "~/shared/lib/query-keys";

export function useProducts(filters: ProductFilters = {}, options?: Partial<UseQueryOptions<ProductsResponse>>) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => productsService.getAll(filters),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useProductDrops(limit = 20, minDiscount = 10, options?: Partial<UseQueryOptions<ProductDrop[]>>) {
  return useQuery({
    queryKey: productKeys.drops(limit, minDiscount),
    queryFn: () => productsService.getDrops(limit, minDiscount),
    ...options,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => productsService.getBySlug(slug),
    enabled: !!slug,
  });
}

export function useQuickSearch(query: string, limit = 10) {
  return useQuery({
    queryKey: productKeys.quickSearch(query),
    queryFn: async () => {
      const response = await productsService.quickSearch(query, limit);
      return response.data;
    },
    enabled: query.trim().length >= 2,
    staleTime: 30000,
  });
}

export function useProductSearch(query: string, limit = 50, offset = 0) {
  return useQuery({
    queryKey: productKeys.search(query, limit, offset),
    queryFn: () => productsService.search(query, limit, offset),
    enabled: !!query,
  });
}

export function usePriceHistory(slug: string, days = 30, options?: Partial<UseQueryOptions<PriceHistoryResponse>>) {
  return useQuery({
    queryKey: productKeys.priceHistory(slug, days),
    queryFn: () => productsService.getPriceHistory(slug, days),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useTrackProductView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: productsService.trackView,
    onSuccess: (_data, slug) => {
      // El backend incrementa el view count + actualiza popularidad. Invalida el detalle del producto
      // y las listas/drops para que el ranking refleje la nueva vista.
      queryClient.invalidateQueries({ queryKey: productKeys.detail(slug) });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}
