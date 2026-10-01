import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CommentNode as CommentNodeT, CommentRoot } from "~/features/comments/services/comments";
import { commentKeys } from "~/shared/lib/query-keys";
import { sessions } from "~/shared/storybook/fixtures";
import { withQueryData } from "~/shared/storybook/with-query-data";
import { CommentBody } from "./comment-body";
import { CommentForm } from "./comment-form";
import { CommentNode } from "./comment-node";
import { CommentsSection } from "./comments-section";

const meta = { title: "Comunidad/Comentarios", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const noop = () => {};

const comment = (id: string, author: string, body: string | null, extra: Partial<CommentNodeT> = {}): CommentNodeT => ({
  id,
  target_type: "product",
  target_id: "8",
  parent_id: null,
  root_id: id,
  path: id,
  depth: 0,
  // Ana (u1) es la de la sesión de ejemplo: sus comentarios muestran editar y eliminar.
  author_id: author === "ana" ? "u1" : `u-${author}`,
  author_username: author,
  author_avatar_url: null,
  body,
  score: 0,
  deleted_at: null,
  deleted_reason: null,
  edited_at: null,
  created_at: ago(180),
  ...extra,
});

const c1 = comment("c1", "matias", "¿Alguien sabe si la Ventus 2X se calienta mucho? La vi a buen precio en TecTec.", {
  score: 12,
  created_at: ago(60 * 26),
});
const c2 = comment("c2", "ana", "La tengo hace un año: con buen flujo de aire no pasa de 70 °C jugando.", {
  parent_id: "c1",
  root_id: "c1",
  path: "c1.c2",
  depth: 1,
  score: 5,
  created_at: ago(60 * 20),
});
const c3 = comment("c3", "fran", "Confirmo, y es bien silenciosa.", {
  parent_id: "c2",
  root_id: "c1",
  path: "c1.c2.c3",
  depth: 2,
  score: 2,
  edited_at: ago(60),
  created_at: ago(90),
});
const c4 = comment(
  "c4",
  "javi",
  "Comparé con la Dual OC de Asus:\n```\nVentus 2X  $279.990\nDual OC    $299.990\n```\nPor `20 lucas` me quedo con la MSI.",
  { score: 3, created_at: ago(240) },
);
const c5 = comment("c5", "anonimo", null, {
  deleted_at: ago(30),
  deleted_reason: "spam",
  created_at: ago(45),
});

const root = (node: CommentNodeT, replyCount: number): CommentRoot => ({
  id: node.id,
  target_id: node.target_id,
  author_id: node.author_id,
  body: node.body,
  score: node.score,
  deleted_at: node.deleted_at,
  deleted_reason: node.deleted_reason,
  edited_at: node.edited_at,
  created_at: node.created_at,
  reply_count: replyCount,
  author_username: node.author_username,
  author_avatar_url: node.author_avatar_url,
});

const thread = (nodes: CommentNodeT[]) => ({ data: nodes, meta: { rootId: nodes[0].id, limit: 200 } });

const withComments = withQueryData([
  [
    commentKeys.productRoots("8", "best"),
    { data: [root(c1, 2), root(c4, 0), root(c5, 0)], meta: { sort: "best", limit: 50, offset: 0 } },
  ],
  [commentKeys.thread("c1"), thread([c1, c2, c3])],
  [commentKeys.thread("c4"), thread([c4])],
  [commentKeys.thread("c5"), thread([c5])],
  [commentKeys.myVotes(["c1", "c2", "c3"]), { data: [{ comment_id: "c3", value: 1 }] }],
  [commentKeys.myVotes(["c4"]), { data: [] }],
  [commentKeys.myVotes(["c5"]), { data: [] }],
]);

export const Seccion: Story = {
  name: "Sección completa",
  parameters: { session: sessions.user },
  decorators: [withComments],
  render: () => <CommentsSection targetType="product" targetId="8" className="max-w-2xl" />,
};

export const SeccionVisitante: Story = {
  name: "Sección completa: visitante",
  decorators: [withComments],
  render: () => <CommentsSection targetType="product" targetId="8" className="max-w-2xl" />,
};

export const SeccionVacia: Story = {
  name: "Sección sin comentarios",
  parameters: { session: sessions.user },
  decorators: [withQueryData([[commentKeys.productRoots("8", "best"), { data: [], meta: { sort: "best" } }]])],
  render: () => <CommentsSection targetType="product" targetId="8" className="max-w-2xl" />,
};

const nodeProps = { myVote: 0 as const, onVote: noop, onReply: noop, onEdit: noop, onDelete: noop };

export const Comentarios: Story = {
  name: "Comentario: estados",
  parameters: { session: sessions.user },
  render: () => (
    <div className="max-w-2xl space-y-6">
      <CommentNode node={c1} {...nodeProps} />
      <CommentNode node={c3} {...nodeProps} myVote={1} />
      <CommentNode node={{ ...c2, created_at: ago(2) }} {...nodeProps} />
      <CommentNode node={c5} {...nodeProps} />
      <CommentNode node={c1} {...nodeProps}>
        <CommentNode node={c2} {...nodeProps}>
          <CommentNode node={c3} {...nodeProps} canReply={false} />
        </CommentNode>
      </CommentNode>
    </div>
  ),
};

export const Cuerpo: Story = {
  name: "Cuerpo con código y enlaces",
  render: () => (
    <CommentBody
      className="max-w-2xl"
      body={
        "Revisa la ficha: https://framerate.cl/producto/rtx-5060 y compara con `RTX 5060 Ti`.\n\n```ts\nconst presupuesto = 600_000;\n```\nUna cotización compartida: https://framerate.cl/cotizacion/abc123"
      }
    />
  ),
};

export const Formulario: Story = {
  name: "Formulario",
  parameters: { session: sessions.user },
  render: () => (
    <div className="max-w-2xl space-y-6">
      <CommentForm compact placeholder="Escribe un comentario…" onSubmit={noop} />
      <CommentForm placeholder="Responder…" submitLabel="Responder" onCancel={noop} onSubmit={noop} />
      <CommentForm
        initialValue="La tengo hace un año: con buen flujo de aire no pasa de 70 °C."
        submitLabel="Guardar cambios"
        onCancel={noop}
        onSubmit={noop}
      />
      <CommentForm busy initialValue="Enviando este comentario" onSubmit={noop} />
    </div>
  ),
};

export const FormularioVisitante: Story = {
  name: "Formulario: visitante",
  render: () => <CommentForm compact onSubmit={noop} className="max-w-2xl" />,
};
