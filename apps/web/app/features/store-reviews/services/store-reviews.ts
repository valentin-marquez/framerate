import type {
  ReviewSort as ApiReviewSort,
  StoreReview as ApiStoreReview,
  RatingStats,
  ReviewItem,
  ReviewList,
} from "@framerate/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "~/shared/lib/api";

export type ReviewSort = "recent" | "helpful" | "rating-desc";

export interface ReviewAuthor {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface StoreReview {
  id: string;
  rating: number;
  comment: string | null;
  helpful_count: number;
  is_pinned: boolean;
  owner_response: string | null;
  owner_response_at: string | null;
  created_at: string;
  edited_at: string | null;
  author: ReviewAuthor | null;
  /** Reseña del usuario que mira. */
  mine: boolean;
  voted_by_me: boolean;
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
  meta: { limit: number; offset: number; total: number; sort: ReviewSort };
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

const SORTS: Record<ReviewSort, ApiReviewSort> = { recent: "recent", helpful: "helpful", "rating-desc": "rating_desc" };
const SORTS_BACK: Record<ApiReviewSort, ReviewSort> = {
  recent: "recent",
  helpful: "helpful",
  rating_desc: "rating-desc",
};

function toReview(r: ApiStoreReview): StoreReview {
  return {
    id: String(r.id),
    rating: r.rating,
    comment: r.comment,
    helpful_count: r.helpfulCount,
    is_pinned: r.isPinned,
    owner_response: r.ownerResponse,
    owner_response_at: r.ownerResponseAt,
    created_at: r.createdAt,
    edited_at: r.editedAt,
    author: r.author
      ? { username: r.author.username, full_name: r.author.displayName, avatar_url: r.author.avatarUrl }
      : null,
    mine: r.mine,
    voted_by_me: r.votedByMe,
    deleted: false,
  };
}

const toItem = (r: ReviewItem): StoreReviewItem =>
  r.deleted
    ? { id: String(r.id), deleted: true, deleted_reason: r.reason, created_at: r.createdAt, is_pinned: r.isPinned }
    : toReview(r);

const base = (slug: string) => `/v1/stores/${encodeURIComponent(slug)}`;

export const storeReviewsService = {
  list: async (
    slug: string,
    sort: ReviewSort = "recent",
    limit = 20,
    offset = 0,
  ): Promise<StoreReviewsListResponse> => {
    const page = await api.get<ReviewList>(`${base(slug)}/reviews`, {
      params: { sort: SORTS[sort], limit: String(limit), offset: String(offset) },
    });
    return {
      data: page.items.map(toItem),
      meta: { limit: page.limit, offset: page.offset, total: page.total, sort: SORTS_BACK[page.sort] },
    };
  },

  stats: async (slug: string): Promise<StoreRatingStats> => {
    const s = await api.get<RatingStats>(`${base(slug)}/reviews/stats`);
    return {
      avg_rating: s.average,
      total_reviews: s.total,
      distribution: {
        "1": s.distribution[1],
        "2": s.distribution[2],
        "3": s.distribution[3],
        "4": s.distribution[4],
        "5": s.distribution[5],
      },
    };
  },

  create: (slug: string, payload: CreateReviewPayload) => api.post<{ id: number }>(`${base(slug)}/reviews`, payload),

  update: (id: string, payload: UpdateReviewPayload) =>
    api.patch<null>(`/v1/reviews/${id}`, {
      rating: payload.rating,
      comment: payload.comment,
      ownerResponse: payload.owner_response,
      isPinned: payload.is_pinned,
    }),

  remove: (id: string) => api.delete<null>(`/v1/reviews/${id}`),

  markHelpful: (id: string) => api.put<null>(`/v1/reviews/${id}/helpful`, {}),

  unmarkHelpful: (id: string) => api.delete<null>(`/v1/reviews/${id}/helpful`),
};

export const storeReviewKeys = {
  all: ["store-reviews"] as const,
  byStore: (slug: string) => [...storeReviewKeys.all, "store", slug] as const,
  list: (slug: string, sort: ReviewSort, limit: number, offset: number) =>
    [...storeReviewKeys.byStore(slug), "list", sort, limit, offset] as const,
  stats: (slug: string) => [...storeReviewKeys.byStore(slug), "stats"] as const,
};

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

/** Mutación que refresca todo lo de la tienda al terminar. */
function useStoreMutation<TVars>(slug: string, fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: storeReviewKeys.byStore(slug) }),
  });
}

export const useCreateStoreReview = (slug: string) =>
  useStoreMutation(slug, (payload: CreateReviewPayload) => storeReviewsService.create(slug, payload));

export const useUpdateStoreReview = (slug: string) =>
  useStoreMutation(slug, ({ id, payload }: { id: string; payload: UpdateReviewPayload }) =>
    storeReviewsService.update(id, payload),
  );

export const useDeleteStoreReview = (slug: string) =>
  useStoreMutation(slug, ({ id }: { id: string; reason?: string }) => storeReviewsService.remove(id));

export const useMarkReviewHelpful = (slug: string) =>
  useStoreMutation(slug, ({ id, helpful }: { id: string; helpful: boolean }) =>
    helpful ? storeReviewsService.markHelpful(id) : storeReviewsService.unmarkHelpful(id),
  );

export const usePinReview = (slug: string) =>
  useStoreMutation(slug, ({ id, pinned }: { id: string; pinned: boolean }) =>
    storeReviewsService.update(id, { is_pinned: pinned }),
  );
