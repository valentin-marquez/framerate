import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "~/features/auth/store/auth";
import {
  type CommentRoot,
  type CommentSort,
  type CommentsListResponse,
  type CommentThreadResponse,
  commentsService,
} from "~/features/comments/services/comments";
import { commentKeys } from "~/shared/lib/query-keys";

async function getToken() {
  const supabase = useAuthStore.getState().supabase;
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export function useProductComments(productId: string, sort: CommentSort = "best") {
  return useQuery({
    queryKey: commentKeys.productRoots(productId, sort),
    queryFn: () => commentsService.listForProduct(productId, sort),
    enabled: !!productId,
  });
}

export function useCommentThread(rootId: string | null, enabled = true) {
  return useQuery({
    queryKey: rootId ? commentKeys.thread(rootId) : ["comments", "thread", "noop"],
    queryFn: () => {
      if (!rootId) throw new Error("rootId required");
      return commentsService.getThread(rootId);
    },
    enabled: enabled && !!rootId,
  });
}

export function useMyVotes(commentIds: string[]) {
  return useQuery({
    queryKey: commentKeys.myVotes(commentIds),
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { data: [] };
      return commentsService.myVotes(commentIds, token);
    },
    enabled: commentIds.length > 0,
  });
}

export function useCreateComment(productId: string, sort: CommentSort) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { parent_id?: string | null; body: string }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return commentsService.create(productId, payload, token);
    },
    onSuccess: (result, vars) => {
      // Invalidate roots list if this is a top-level comment, otherwise the
      // affected thread.
      if (!vars.parent_id) {
        queryClient.invalidateQueries({ queryKey: commentKeys.productRoots(productId, sort) });
      } else if (result.data.root_id) {
        queryClient.invalidateQueries({ queryKey: commentKeys.thread(result.data.root_id) });
        // Reply count on the root changed; bump the listing too.
        queryClient.invalidateQueries({ queryKey: commentKeys.productRoots(productId, sort) });
      }
    },
  });
}

export function useEditComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return commentsService.edit(id, body, token);
    },
    onSuccess: () => {
      // Invalidate all comment caches because we don't know which thread without an extra fetch.
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });
}

export function useSoftDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return commentsService.softDelete(id, reason, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });
}

export function useVoteComment(productId: string, sort: CommentSort, rootId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, value }: { commentId: string; value: -1 | 0 | 1 }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return commentsService.vote(commentId, value, token);
    },
    // Optimistic update: shift score by delta locally.
    onMutate: async ({ commentId, value }) => {
      // Cancel relevant queries.
      const rootsKey = commentKeys.productRoots(productId, sort);
      const threadKey = rootId ? commentKeys.thread(rootId) : null;

      await queryClient.cancelQueries({ queryKey: rootsKey });
      if (threadKey) await queryClient.cancelQueries({ queryKey: threadKey });

      const prevRoots = queryClient.getQueryData<CommentsListResponse>(rootsKey);
      const prevThread = threadKey ? queryClient.getQueryData<CommentThreadResponse>(threadKey) : undefined;

      // Determine previous vote from cached my-votes if available.
      // Without it we conservatively assume value 0 (no vote).
      const currentVotes = queryClient
        .getQueriesData<{ data: { comment_id: string; value: number }[] }>({ queryKey: commentKeys.all })
        .flatMap(([, v]) => v?.data ?? []);
      const prev = currentVotes.find((vt) => vt.comment_id === commentId)?.value ?? 0;
      const delta = value - prev;

      if (prevRoots) {
        queryClient.setQueryData<CommentsListResponse>(rootsKey, {
          ...prevRoots,
          data: prevRoots.data.map((r: CommentRoot) => (r.id === commentId ? { ...r, score: r.score + delta } : r)),
        });
      }

      if (threadKey && prevThread) {
        queryClient.setQueryData<CommentThreadResponse>(threadKey, {
          ...prevThread,
          data: prevThread.data.map((n) => (n.id === commentId ? { ...n, score: n.score + delta } : n)),
        });
      }

      return { prevRoots, prevThread, rootsKey, threadKey };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      if (ctx.prevRoots) queryClient.setQueryData(ctx.rootsKey, ctx.prevRoots);
      if (ctx.threadKey && ctx.prevThread) queryClient.setQueryData(ctx.threadKey, ctx.prevThread);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });
}
