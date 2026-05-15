/**
 * @module features/store-reviews/services/store-reviews.client
 *
 * Cliente del API para reseñas de tiendas. Hooks de TanStack Query.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "~/features/auth/store/auth";
import { api } from "~/shared/lib/api";

export type ReviewSort = "recent" | "helpful" | "rating-desc";

export interface ReviewAuthor {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface StoreReview {
  id: string;
  store_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  helpful_count: number;
  is_pinned: boolean;
  owner_response: string | null;
  owner_response_at: string | null;
  owner_response_by: string | null;
  deleted_at: string | null;
  deleted_reason: string | null;
  created_at: string;
  updated_at: string;
  author: ReviewAuthor | null;
  deleted: false;
}

export interface DeletedStoreReview {
  id: string;
  deleted: true;
  deleted_reason: string | null;
  created_at: string;
  is_pinned: boolean;
}

export type StoreReviewItem = StoreReview | DeletedStoreReview;

export interface StoreReviewsListResponse {
  data: StoreReviewItem[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    sort: ReviewSort;
  };
}

export interface StoreRatingStats {
  avg_rating: number | null;
  total_reviews: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string | null;
}

export interface UpdateReviewPayload {
  rating?: number;
  comment?: string | null;
  owner_response?: string | null;
  is_pinned?: boolean;
}

async function getToken() {
  const supabase = useAuthStore.getState().supabase;
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export const storeReviewsService = {
  list: (slug: string, sort: ReviewSort = "recent", limit = 20, offset = 0) =>
    api.get<StoreReviewsListResponse>(`/v1/stores/${encodeURIComponent(slug)}/reviews`, {
      params: { sort, limit: String(limit), offset: String(offset) },
    }),

  stats: (slug: string) => api.get<StoreRatingStats>(`/v1/stores/${encodeURIComponent(slug)}/reviews/stats`),

  create: (slug: string, payload: CreateReviewPayload, token?: string) =>
    api.post<StoreReview>(`/v1/stores/${encodeURIComponent(slug)}/reviews`, payload, { token }),

  update: (id: string, payload: UpdateReviewPayload, token?: string) =>
    api.patch<StoreReview>(`/v1/reviews/${id}`, payload, { token }),

  remove: (id: string, reason?: string, token?: string) =>
    api.delete<{ ok: true }>(`/v1/reviews/${id}`, {
      token,
      body: reason ? JSON.stringify({ reason }) : undefined,
    }),

  markHelpful: (id: string, token?: string) =>
    api.post<{ ok: true; already: boolean }>(`/v1/reviews/${id}/helpful`, {}, { token }),

  unmarkHelpful: (id: string, token?: string) => api.delete<{ ok: true }>(`/v1/reviews/${id}/helpful`, { token }),

  pin: (id: string, token?: string) => api.post<StoreReview>(`/v1/reviews/${id}/pin`, {}, { token }),
};

// =============================================================================
// Query keys
// =============================================================================

export const storeReviewKeys = {
  all: ["store-reviews"] as const,
  byStore: (slug: string) => [...storeReviewKeys.all, "store", slug] as const,
  list: (slug: string, sort: ReviewSort, limit: number, offset: number) =>
    [...storeReviewKeys.byStore(slug), "list", sort, limit, offset] as const,
  stats: (slug: string) => [...storeReviewKeys.byStore(slug), "stats"] as const,
};

// =============================================================================
// Hooks
// =============================================================================

export function useStoreReviews(slug: string, sort: ReviewSort = "recent", limit = 20, offset = 0) {
  return useQuery({
    queryKey: storeReviewKeys.list(slug, sort, limit, offset),
    queryFn: () => storeReviewsService.list(slug, sort, limit, offset),
    enabled: !!slug,
  });
}

export function useStoreRatingStats(slug: string) {
  return useQuery({
    queryKey: storeReviewKeys.stats(slug),
    queryFn: () => storeReviewsService.stats(slug),
    enabled: !!slug,
  });
}

export function useCreateStoreReview(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateReviewPayload) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return storeReviewsService.create(slug, payload, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeReviewKeys.byStore(slug) });
    },
  });
}

export function useUpdateStoreReview(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateReviewPayload }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return storeReviewsService.update(id, payload, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeReviewKeys.byStore(slug) });
    },
  });
}

export function useDeleteStoreReview(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return storeReviewsService.remove(id, reason, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeReviewKeys.byStore(slug) });
    },
  });
}

export function useMarkReviewHelpful(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return helpful ? storeReviewsService.markHelpful(id, token) : storeReviewsService.unmarkHelpful(id, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeReviewKeys.byStore(slug) });
    },
  });
}

export function usePinReview(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return storeReviewsService.pin(id, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeReviewKeys.byStore(slug) });
    },
  });
}
