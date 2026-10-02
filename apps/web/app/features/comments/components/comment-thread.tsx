import type { Comment } from "@framerate/contracts";
import { COMMENT_MAX_DEPTH } from "@framerate/contracts";
import { useMemo, useState } from "react";
import { CommentNode } from "~/features/comments/components/comment-node";
import {
  useCommentThread,
  useCreateComment,
  useDeleteComment,
  useEditComment,
  useLikeComment,
} from "~/features/comments/hooks/useComments";
import { Button } from "~/shared/components/primitives/button";

interface CommentThreadProps {
  productId: number;
  root: Comment;
  initiallyExpanded?: boolean;
}

const INITIAL_RENDER_LIMIT = 50;

interface TreeNode {
  node: Comment;
  children: TreeNode[];
}

function buildTree(nodes: Comment[]): TreeNode | null {
  const byId = new Map<number, TreeNode>();
  for (const n of nodes) byId.set(n.id, { node: n, children: [] });

  let root: TreeNode | null = null;
  for (const n of nodes) {
    const tn = byId.get(n.id);
    if (!tn) continue;
    const parent = n.parentId === null ? undefined : byId.get(n.parentId);
    if (parent) parent.children.push(tn);
    else root = tn;
  }
  return root;
}

export function CommentThread({ productId, root, initiallyExpanded }: CommentThreadProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded ?? root.replyCount === 0);
  const { data: threadData } = useCommentThread(root.id, expanded);
  const tree = useMemo(() => buildTree(threadData?.items ?? []), [threadData]);
  const total = threadData?.items.length ?? 0;

  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT);

  const createMutation = useCreateComment(productId);
  const likeMutation = useLikeComment();
  const editMutation = useEditComment();
  const deleteMutation = useDeleteComment();

  const actions: Actions = {
    onLike: (c) => likeMutation.mutate({ id: c.id, liked: !c.likedByMe }),
    onReply: async (parentId, body) => {
      await createMutation.mutateAsync({ parentId, body });
      setExpanded(true);
    },
    onEdit: async (id, body) => {
      await editMutation.mutateAsync({ id, body });
    },
    onDelete: (id) => deleteMutation.mutate(id),
  };

  // Mientras el hilo no carga (o está colapsado) se muestra la raíz de la lista.
  const node = tree?.node ?? root;
  return (
    <div className="space-y-2">
      <CommentNode
        node={node}
        onLike={() => actions.onLike(node)}
        onReply={(body) => actions.onReply(node.id, body)}
        onEdit={(body) => actions.onEdit(node.id, body)}
        onDelete={() => actions.onDelete(node.id)}
        canReply={node.depth < COMMENT_MAX_DEPTH}
      >
        {expanded && tree && <ChildList nodes={tree.children} renderLimit={renderLimit} {...actions} />}
      </CommentNode>

      {!expanded && root.replyCount > 0 && (
        <div className="pl-11">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
            Ver {root.replyCount} {root.replyCount === 1 ? "respuesta" : "respuestas"}
          </Button>
        </div>
      )}

      {expanded && total > renderLimit && (
        <div className="pl-11">
          <Button variant="ghost" size="sm" onClick={() => setRenderLimit((n) => n + 50)}>
            Ver más comentarios
          </Button>
        </div>
      )}
    </div>
  );
}

interface Actions {
  onLike: (comment: Comment) => void;
  onReply: (parentId: number, body: string) => Promise<void>;
  onEdit: (id: number, body: string) => Promise<void>;
  onDelete: (id: number) => void;
}

interface ChildListProps extends Actions {
  nodes: TreeNode[];
  renderLimit: number;
}

function ChildList({ nodes, renderLimit, ...actions }: ChildListProps) {
  if (nodes.length === 0) return null;
  return (
    <>
      {nodes.slice(0, renderLimit).map((tn) => {
        const node = tn.node;
        return (
          <CommentNode
            key={node.id}
            node={node}
            onLike={() => actions.onLike(node)}
            onReply={(body) => actions.onReply(node.id, body)}
            onEdit={(body) => actions.onEdit(node.id, body)}
            onDelete={() => actions.onDelete(node.id)}
            canReply={node.depth < COMMENT_MAX_DEPTH}
          >
            <ChildList nodes={tn.children} renderLimit={renderLimit} {...actions} />
          </CommentNode>
        );
      })}
    </>
  );
}
