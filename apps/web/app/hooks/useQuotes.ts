import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AddItemRequest,
  type CreateQuoteRequest,
  quotesService,
  type UpdateItemRequest,
  type UpdateQuoteRequest,
} from "@/services/quotes";
import { useAuthStore } from "@/store/auth";

async function getToken() {
  const supabase = useAuthStore.getState().supabase;
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export const QUOTES_QUERY_KEY = ["quotes"];
export const QUOTE_DETAIL_QUERY_KEY = (id: string) => ["quotes", id];

export function useQuotes(page = 1, limit = 10) {
  return useQuery({
    queryKey: [...QUOTES_QUERY_KEY, page, limit],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return quotesService.getAll(page, limit, token);
    },
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: QUOTE_DETAIL_QUERY_KEY(id),
    queryFn: async () => {
      const token = await getToken();
      return quotesService.getById(id, token);
    },
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateQuoteRequest) => {
      const token = await getToken();
      return quotesService.create(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUOTES_QUERY_KEY });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateQuoteRequest }) => {
      const token = await getToken();
      return quotesService.update(id, data, token);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUOTES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: QUOTE_DETAIL_QUERY_KEY(id) });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return quotesService.delete(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUOTES_QUERY_KEY });
    },
  });
}

export function useQuoteAddItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, data }: { quoteId: string; data: AddItemRequest }) => {
      const token = await getToken();
      return quotesService.addItem(quoteId, data, token);
    },
    onSuccess: (_, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: QUOTE_DETAIL_QUERY_KEY(quoteId) });
    },
  });
}

export function useQuoteUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, itemId, data }: { quoteId: string; itemId: string; data: UpdateItemRequest }) => {
      const token = await getToken();
      return quotesService.updateItem(quoteId, itemId, data, token);
    },
    onSuccess: (_, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: QUOTE_DETAIL_QUERY_KEY(quoteId) });
    },
  });
}

export function useQuoteRemoveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, itemId }: { quoteId: string; itemId: string }) => {
      const token = await getToken();
      return quotesService.removeItem(quoteId, itemId, token);
    },
    onSuccess: (_, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: QUOTE_DETAIL_QUERY_KEY(quoteId) });
    },
  });
}

export function useAnalyzeQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return quotesService.analyzeQuote(id, token);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUOTE_DETAIL_QUERY_KEY(id) });
    },
  });
}

export function useAnalyzeBuild() {
  return useMutation({
    mutationFn: (productIds: string[]) => quotesService.analyze(productIds),
  });
}
