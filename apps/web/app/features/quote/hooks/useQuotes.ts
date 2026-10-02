import type { UpdateQuoteRequest } from "@framerate/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quotesService } from "~/features/quote/services/quotes";
import { quoteKeys } from "~/shared/lib/query-keys";

export function useQuotes(page = 1, limit = 10, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: quoteKeys.list(page, limit),
    queryFn: () => quotesService.getAll(page, limit),
    enabled: options?.enabled ?? true,
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: quoteKeys.detail(id),
    queryFn: () => quotesService.getById(id),
    enabled: !!id,
  });
}

type CreateInput = Parameters<typeof quotesService.create>[0];
type AddItemInput = Parameters<typeof quotesService.addItem>[1];
type UpdateItemInput = Parameters<typeof quotesService.updateItem>[2];

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInput) => quotesService.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quoteKeys.all }),
  });
}

/** Agregar, cambiar cantidad y quitar devuelven el detalle ya actualizado: se deja en la caché del detalle. */
export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuoteRequest }) => quotesService.update(id, data),
    onSuccess: (detail, { id }) => {
      queryClient.setQueryData(quoteKeys.detail(id), detail);
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quoteKeys.all }),
  });
}

export function useQuoteAddItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, data }: { quoteId: string; data: AddItemInput }) => quotesService.addItem(quoteId, data),
    onSuccess: (detail, { quoteId }) => {
      queryClient.setQueryData(quoteKeys.detail(quoteId), detail);
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

export function useQuoteUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, itemId, data }: { quoteId: string; itemId: number; data: UpdateItemInput }) =>
      quotesService.updateItem(quoteId, itemId, data),
    onSuccess: (detail, { quoteId }) => queryClient.setQueryData(quoteKeys.detail(quoteId), detail),
  });
}

export function useQuoteRemoveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, itemId }: { quoteId: string; itemId: number }) => quotesService.removeItem(quoteId, itemId),
    onSuccess: (detail, { quoteId }) => {
      queryClient.setQueryData(quoteKeys.detail(quoteId), detail);
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}
