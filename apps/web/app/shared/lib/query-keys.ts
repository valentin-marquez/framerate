export const categoryKeys = {
  all: ["categories"] as const,
};

export const quoteKeys = {
  all: ["quotes"] as const,
  lists: () => [...quoteKeys.all, "list"] as const,
  list: (page: number, limit: number) => [...quoteKeys.lists(), page, limit] as const,
  details: () => [...quoteKeys.all, "detail"] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
  condense: (id: string) => [...quoteKeys.all, "condense", id] as const,
};

// Fase 3: comments
export const commentKeys = {
  all: ["comments"] as const,
  productRoots: (productId: number, sort: string, pageSize: number) =>
    [...commentKeys.all, "product", productId, sort, pageSize] as const,
  thread: (rootId: number) => [...commentKeys.all, "thread", rootId] as const,
};
