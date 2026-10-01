import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AddItemRequest,
  type CreateQuoteRequest,
  QUOTES_API_ENABLED,
  type QuotesListResponse,
  quotesService,
  type UpdateItemRequest,
  type UpdateQuoteRequest,
} from "~/features/quote/services/quotes";
import { quoteKeys } from "~/shared/lib/query-keys";

export function useQuotes(page = 1, limit = 10, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: quoteKeys.list(page, limit),
    queryFn: () => quotesService.getAll(page, limit),
    enabled: QUOTES_API_ENABLED && (options?.enabled ?? true),
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: quoteKeys.detail(id),
    queryFn: () => quotesService.getById(id),
    enabled: QUOTES_API_ENABLED && !!id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuoteRequest) => quotesService.create(data),
    onMutate: async (newQuote) => {
      await queryClient.cancelQueries({ queryKey: quoteKeys.all });

      const previousQuotes = queryClient.getQueryData(quoteKeys.all);

      queryClient.setQueriesData<QuotesListResponse>({ queryKey: quoteKeys.all }, (old) => {
        if (!old) return old;

        const optimisticQuote = {
          id: `temp-${Date.now()}`,
          name: newQuote.name,
          description: newQuote.description || null,
          is_public: newQuote.is_public || false,
          compatibility_status: "unknown" as const,
          estimated_wattage: null,
          last_analyzed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          quote_items: [{ count: 0 }] as [{ count: number }],
        };

        return {
          ...old,
          data: [optimisticQuote, ...old.data],
          meta: {
            ...old.meta,
            total: old.meta.total + 1,
          },
        };
      });

      return { previousQuotes };
    },
    onError: (_err, _newQuote, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(quoteKeys.all, context.previousQuotes);
      }
    },
    // Replace the optimistic temp- entry with the real one in-place. Avoids a refetch that
    // would briefly drop the new quote from the list (causing a flicker before navigation).
    onSuccess: (newQuote) => {
      queryClient.setQueriesData<QuotesListResponse>({ queryKey: quoteKeys.all }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((q) =>
            q.id.startsWith("temp-")
              ? {
                  ...q,
                  id: newQuote.id,
                  created_at: newQuote.created_at,
                  updated_at: newQuote.updated_at,
                }
              : q,
          ),
        };
      });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuoteRequest }) => quotesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(id) });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}

export function useQuoteAddItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, data }: { quoteId: string; data: AddItemRequest }) => quotesService.addItem(quoteId, data),
    onSuccess: (_, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
    },
  });
}

export function useQuoteUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, itemId, data }: { quoteId: string; itemId: string; data: UpdateItemRequest }) =>
      quotesService.updateItem(quoteId, itemId, data),
    onSuccess: (_, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
    },
  });
}

export function useQuoteRemoveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, itemId }: { quoteId: string; itemId: string }) => quotesService.removeItem(quoteId, itemId),
    onSuccess: (_, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
    },
  });
}

export function useAnalyzeQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotesService.analyzeQuote(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(id) });
    },
  });
}

export function useAnalyzeBuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productIds: string[]) => quotesService.analyze(productIds),
    onSuccess: () => {
      // El análisis no toca cotizaciones persistidas, pero invalidamos listas y detalles
      // por si la respuesta cambia rankings/derivados cacheados.
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}
