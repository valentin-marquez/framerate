export const productKeys = {
  all: ["products"] as const,
  quickSearch: (query: string) => [...productKeys.all, "quick-search", query] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
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
  myVotes: (ids: string[]) => [...commentKeys.all, "my-votes", ids.toSorted().join(",")] as const,
};
