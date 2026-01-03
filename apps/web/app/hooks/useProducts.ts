import { keepPreviousData, type UseQueryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { type ProductDrop, type ProductFilters, type ProductsResponse, productsService } from "@/services/products";

export const PRODUCTS_QUERY_KEY = ["products"];
export const PRODUCT_DROPS_QUERY_KEY = ["products", "drops"];
export const PRODUCT_DETAIL_QUERY_KEY = (slug: string) => ["products", slug];
export const QUICK_SEARCH_QUERY_KEY = (query: string) => ["products", "quick-search", query];

export function useProducts(filters: ProductFilters = {}, options?: Partial<UseQueryOptions<ProductsResponse>>) {
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, filters],
    queryFn: () => productsService.getAll(filters),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useProductDrops(limit = 20, minDiscount = 10, options?: Partial<UseQueryOptions<ProductDrop[]>>) {
  return useQuery({
    queryKey: [...PRODUCT_DROPS_QUERY_KEY, limit, minDiscount],
    queryFn: () => productsService.getDrops(limit, minDiscount),
    ...options,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: PRODUCT_DETAIL_QUERY_KEY(slug),
    queryFn: () => productsService.getBySlug(slug),
    enabled: !!slug,
  });
}

export function useQuickSearch(query: string, limit = 10) {
  return useQuery({
    queryKey: QUICK_SEARCH_QUERY_KEY(query),
    queryFn: async () => {
      const response = await productsService.quickSearch(query, limit);
      return response.data;
    },
    enabled: query.trim().length >= 2,
    staleTime: 30000, // 30 segundos
  });
}

export function useProductSearch(query: string, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["products", "search", query, limit, offset],
    queryFn: () => productsService.search(query, limit, offset),
    enabled: !!query,
  });
}

export function useTrackProductView() {
  return useMutation({
    mutationFn: productsService.trackView,
  });
}
