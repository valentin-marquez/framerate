import type {
  Comment,
  CommentLike,
  CommentPage,
  CommentSort,
  CommentThread,
  CreateCommentRequest,
} from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export const commentsService = {
  listForProduct: (productId: number, sort: CommentSort = "best", pageSize = 20) =>
    api.get<CommentPage>(`/v1/products/${productId}/comments`, {
      params: { sort, page: "1", pageSize: String(pageSize) },
    }),

  getThread: (rootId: number) => api.get<CommentThread>(`/v1/comments/${rootId}/thread`),

  create: (productId: number, payload: CreateCommentRequest) =>
    api.post<Comment>(`/v1/products/${productId}/comments`, payload),

  edit: (commentId: number, body: string) => api.patch<Comment>(`/v1/comments/${commentId}`, { body }),

  remove: (commentId: number) => api.delete<Comment>(`/v1/comments/${commentId}`),

  like: (commentId: number) => api.put<CommentLike>(`/v1/comments/${commentId}/like`, {}),

  unlike: (commentId: number) => api.delete<CommentLike>(`/v1/comments/${commentId}/like`),
};
