import type { Comment, CommentSort } from "@framerate/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commentsService } from "~/features/comments/services/comments";
import { commentKeys } from "~/shared/lib/query-keys";

export function useProductComments(productId: number, sort: CommentSort, pageSize: number) {
  return useQuery({
    queryKey: commentKeys.productRoots(productId, sort, pageSize),
    queryFn: () => commentsService.listForProduct(productId, sort, pageSize),
  });
}

export function useCommentThread(rootId: number, enabled = true) {
  return useQuery({
    queryKey: commentKeys.thread(rootId),
    queryFn: () => commentsService.getThread(rootId),
    enabled,
  });
}

export function useCreateComment(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { parentId?: number | null; body: string }) => commentsService.create(productId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.all }),
  });
}

export function useEditComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => commentsService.edit(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.all }),
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => commentsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.all }),
  });
}

type WithItems = { items: Comment[] };

/** Me gusta optimista: parchea el comentario en todas las listas e hilos cacheados. */
export function useLikeComment() {
  const queryClient = useQueryClient();
  const patch = (id: number, liked: boolean) =>
    queryClient.setQueriesData<WithItems>({ queryKey: commentKeys.all }, (old) =>
      old?.items
        ? {
            ...old,
            items: old.items.map((c) =>
              c.id === id ? { ...c, likedByMe: liked, likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)) } : c,
            ),
          }
        : old,
    );
  return useMutation({
    mutationFn: ({ id, liked }: { id: number; liked: boolean }) =>
      liked ? commentsService.like(id) : commentsService.unlike(id),
    onMutate: async ({ id, liked }) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all });
      patch(id, liked);
    },
    onError: (_err, { id, liked }) => {
      patch(id, !liked);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: commentKeys.all }),
  });
}
