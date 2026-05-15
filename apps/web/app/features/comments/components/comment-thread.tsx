import { useMemo, useState } from "react";
import { CommentNode } from "~/features/comments/components/comment-node";
import {
  useCommentThread,
  useCreateComment,
  useEditComment,
  useMyVotes,
  useSoftDeleteComment,
  useVoteComment,
} from "~/features/comments/hooks/useComments";
import type { CommentNode as CommentNodeT, CommentRoot, CommentSort } from "~/features/comments/services/comments";
import { Button } from "~/shared/components/primitives/button";

interface CommentThreadProps {
  productId: string;
  root: CommentRoot;
  sort: CommentSort;
  initiallyExpanded?: boolean;
}

const MAX_RENDER_DEPTH = 10;
const INITIAL_RENDER_LIMIT = 50;

interface TreeNode {
  node: CommentNodeT | CommentRoot;
  children: TreeNode[];
}

function buildTree(nodes: CommentNodeT[]): TreeNode | null {
  if (nodes.length === 0) return null;
  // First node by `path` order is the root.
  const byId = new Map<string, TreeNode>();
  for (const n of nodes) byId.set(n.id, { node: n, children: [] });

  let root: TreeNode | null = null;
  for (const n of nodes) {
    const tn = byId.get(n.id);
    if (!tn) continue;
    if (n.parent_id && byId.has(n.parent_id)) {
      byId.get(n.parent_id)?.children.push(tn);
    } else {
      root = tn;
    }
  }
  return root;
}

export function CommentThread({ productId, root, sort, initiallyExpanded }: CommentThreadProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded ?? root.reply_count === 0);
  const { data: threadData } = useCommentThread(root.id, expanded);

  const nodes = threadData?.data ?? [];
  const tree = useMemo(() => buildTree(nodes), [nodes]);

  // Show-more cap to avoid rendering huge subtrees up front.
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT);

  const ids = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const { data: myVotesData } = useMyVotes(ids);
  const voteMap = useMemo(() => {
    const m = new Map<string, -1 | 1>();
    for (const v of myVotesData?.data ?? []) m.set(v.comment_id, v.value as -1 | 1);
    return m;
  }, [myVotesData]);

  const createMutation = useCreateComment(productId, sort);
  const voteMutation = useVoteComment(productId, sort, root.id);
  const editMutation = useEditComment();
  const deleteMutation = useSoftDeleteComment();

  // Render the root using its own metadata (so the score/edits stay accurate
  // even before the thread loads).
  const renderRoot = (): React.ReactNode => {
    const rootDisplay: CommentNodeT = {
      id: root.id,
      target_type: "product",
      target_id: root.target_id,
      parent_id: null,
      root_id: root.id,
      path: "",
      depth: 0,
      author_id: root.author_id,
      author_username: root.author_username,
      author_avatar_url: root.author_avatar_url,
      body: root.body,
      score: tree?.node ? (tree.node as CommentNodeT).score : root.score,
      deleted_at: root.deleted_at,
      deleted_reason: root.deleted_reason,
      edited_at: root.edited_at,
      created_at: root.created_at,
    };

    const node = (tree?.node as CommentNodeT) || rootDisplay;
    return (
      <CommentNode
        node={node}
        myVote={voteMap.get(node.id) ?? 0}
        onVote={(v) => voteMutation.mutate({ commentId: node.id, value: v })}
        onReply={async (body) => {
          await createMutation.mutateAsync({ parent_id: node.id, body });
          // Force-expand after replying so the new node appears.
          setExpanded(true);
        }}
        onEdit={async (body) => {
          await editMutation.mutateAsync({ id: node.id, body });
        }}
        onDelete={() => deleteMutation.mutate({ id: node.id })}
        canReply={node.depth < MAX_RENDER_DEPTH}
      >
        {expanded && tree && (
          <ChildList
            nodes={tree.children}
            voteMap={voteMap}
            renderLimit={renderLimit}
            onVote={(id, v) => voteMutation.mutate({ commentId: id, value: v })}
            onReply={async (parentId, body) => {
              await createMutation.mutateAsync({ parent_id: parentId, body });
            }}
            onEdit={async (id, body) => {
              await editMutation.mutateAsync({ id, body });
            }}
            onDelete={(id) => deleteMutation.mutate({ id })}
          />
        )}
      </CommentNode>
    );
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      {renderRoot()}

      {!expanded && root.reply_count > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          Ver {root.reply_count} {root.reply_count === 1 ? "respuesta" : "respuestas"}
        </Button>
      )}

      {expanded && nodes.length > renderLimit && (
        <Button variant="ghost" size="sm" onClick={() => setRenderLimit((n) => n + 50)}>
          Ver más comentarios
        </Button>
      )}
    </div>
  );
}

interface ChildListProps {
  nodes: TreeNode[];
  voteMap: Map<string, -1 | 1>;
  renderLimit: number;
  onVote: (id: string, v: -1 | 0 | 1) => void;
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => void;
}

function ChildList({ nodes, voteMap, renderLimit, onVote, onReply, onEdit, onDelete }: ChildListProps) {
  if (nodes.length === 0) return null;
  const visible = nodes.slice(0, renderLimit);
  return (
    <>
      {visible.map((tn) => {
        const node = tn.node as CommentNodeT;
        return (
          <CommentNode
            key={node.id}
            node={node}
            myVote={voteMap.get(node.id) ?? 0}
            onVote={(v) => onVote(node.id, v)}
            onReply={(body) => onReply(node.id, body)}
            onEdit={(body) => onEdit(node.id, body)}
            onDelete={() => onDelete(node.id)}
            canReply={node.depth < MAX_RENDER_DEPTH}
          >
            <ChildList
              nodes={tn.children}
              voteMap={voteMap}
              renderLimit={renderLimit}
              onVote={onVote}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </CommentNode>
        );
      })}
    </>
  );
}
