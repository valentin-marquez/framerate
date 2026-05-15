/**
 * Comments service (Fase 3).
 *
 * All requests go through the API gateway; no direct Supabase access.
 */
import { api } from "~/shared/lib/api";

export type CommentTargetType = "product";

export interface CommentRoot {
  id: string;
  target_id: string;
  author_id: string | null;
  body: string | null;
  score: number;
  deleted_at: string | null;
  deleted_reason: string | null;
  edited_at: string | null;
  created_at: string;
  reply_count: number;
  author_username: string | null;
  author_avatar_url: string | null;
}

export interface CommentNode {
  id: string;
  target_type: CommentTargetType;
  target_id: string;
  parent_id: string | null;
  root_id: string;
  path: string;
  depth: number;
  author_id: string | null;
  body: string | null;
  score: number;
  deleted_at: string | null;
  deleted_reason: string | null;
  edited_at: string | null;
  created_at: string;
  author_username: string | null;
  author_avatar_url: string | null;
}

export interface CommentsListResponse {
  data: CommentRoot[];
  meta: { sort: string; limit: number; offset: number };
}

export interface CommentThreadResponse {
  data: CommentNode[];
  meta: { rootId: string; limit: number };
}

export interface MyVote {
  comment_id: string;
  value: -1 | 1;
}

export type CommentSort = "best" | "recent" | "old";

export const commentsService = {
  listForProduct: (productId: string, sort: CommentSort = "best", limit = 50, offset = 0) =>
    api.get<CommentsListResponse>(`/v1/products/${productId}/comments`, {
      params: { sort, limit: String(limit), offset: String(offset) },
    }),

  getThread: (rootId: string, limit = 200) =>
    api.get<CommentThreadResponse>(`/v1/comments/${rootId}/thread`, {
      params: { limit: String(limit) },
    }),

  create: (productId: string, payload: { parent_id?: string | null; body: string }, token: string) =>
    api.post<{ data: CommentNode }>(`/v1/products/${productId}/comments`, payload, { token }),

  edit: (commentId: string, body: string, token: string) =>
    api.patch<{ data: { id: string; body: string; edited_at: string; score: number } }>(
      `/v1/comments/${commentId}`,
      { body },
      { token },
    ),

  softDelete: (commentId: string, reason: string | undefined, token: string) =>
    api.delete<{ data: { id: string; deleted_at: string; deleted_reason: string } }>(`/v1/comments/${commentId}`, {
      token,
      // delete with body needs explicit body
      body: JSON.stringify(reason ? { reason } : {}),
      headers: { "Content-Type": "application/json" },
    }),

  vote: (commentId: string, value: -1 | 0 | 1, token: string) =>
    api.post<{ data: { id: string; value: number; score: number } }>(
      `/v1/comments/${commentId}/vote`,
      { value },
      { token },
    ),

  myVotes: (commentIds: string[], token: string) => {
    if (commentIds.length === 0) return Promise.resolve({ data: [] as MyVote[] });
    return api.get<{ data: MyVote[] }>(`/v1/comments/me/votes`, {
      params: { ids: commentIds.join(",") },
      token,
    });
  },
};
