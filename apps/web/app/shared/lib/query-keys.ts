import type { ProductFilters } from "~/features/product/services/products";

/**
 * Centralized query key factories following TanStack Query best practices.
 * Hierarchical structure enables targeted invalidation at any level.
 *
 * @example
 * // Invalidate all products
 * queryClient.invalidateQueries({ queryKey: productKeys.all })
 *
 * // Invalidate only product lists (not details)
 * queryClient.invalidateQueries({ queryKey: productKeys.lists() })
 *
 * // Invalidate a specific product detail
 * queryClient.invalidateQueries({ queryKey: productKeys.detail("rtx-4090") })
 */
export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (slug: string) => [...productKeys.details(), slug] as const,
  priceHistory: (slug: string, days: number) => [...productKeys.detail(slug), "price-history", days] as const,
  drops: (limit: number, minDiscount: number) => [...productKeys.all, "drops", limit, minDiscount] as const,
  search: (query: string, limit: number, offset: number) =>
    [...productKeys.all, "search", query, limit, offset] as const,
  quickSearch: (query: string) => [...productKeys.all, "quick-search", query] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
  filters: (slug: string) => [...categoryKeys.all, slug, "filters"] as const,
  brands: (slug: string) => [...categoryKeys.all, slug, "brands"] as const,
  priceRange: (slug: string) => [...categoryKeys.all, slug, "priceRange"] as const,
};

export const quoteKeys = {
  all: ["quotes"] as const,
  list: (page: number, limit: number) => [...quoteKeys.all, "list", page, limit] as const,
  details: () => [...quoteKeys.all, "detail"] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
};

// Fase 3: comments
export const commentKeys = {
  all: ["comments"] as const,
  productRoots: (productId: string, sort: string) => [...commentKeys.all, "product", productId, sort] as const,
  thread: (rootId: string) => [...commentKeys.all, "thread", rootId] as const,
  myVotes: (ids: string[]) => [...commentKeys.all, "my-votes", [...ids].sort().join(",")] as const,
};
