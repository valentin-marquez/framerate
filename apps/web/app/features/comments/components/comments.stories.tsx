import type { Comment } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
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

const comment = (id: number, author: string, body: string | null, extra: Partial<Comment> = {}): Comment => ({
  id,
  productId: 8,
  parentId: null,
  rootId: id,
  depth: 0,
  body,
  likeCount: 0,
  likedByMe: false,
  replyCount: 0,
  editedAt: null,
  deletedAt: null,
  deletionReason: null,
  createdAt: ago(180),
  // Ana es la de la sesión de ejemplo: sus comentarios muestran editar y eliminar.
  author: { username: author, displayName: author, avatarUrl: null },
  ...extra,
});

const c1 = comment(1, "matias", "¿Alguien sabe si la Ventus 2X se calienta mucho? La vi a buen precio en TecTec.", {
  likeCount: 12,
  replyCount: 2,
  createdAt: ago(60 * 26),
});
const c2 = comment(2, "ana", "La tengo hace un año: con buen flujo de aire no pasa de 70 °C jugando.", {
  parentId: 1,
  rootId: 1,
  depth: 1,
  likeCount: 5,
  createdAt: ago(60 * 20),
});
const c3 = comment(3, "fran", "Confirmo, y es bien silenciosa.", {
  parentId: 2,
  rootId: 1,
  depth: 2,
  likeCount: 2,
  likedByMe: true,
  editedAt: ago(60),
  createdAt: ago(90),
});
const c4 = comment(
  4,
  "javi",
  "Comparé con la Dual OC de Asus:\n```\nVentus 2X  $279.990\nDual OC    $299.990\n```\nPor `20 lucas` me quedo con la MSI.",
  { likeCount: 3, createdAt: ago(240) },
);
const c5 = comment(5, "anonimo", null, {
  author: null,
  deletedAt: ago(30),
  deletionReason: "moderation",
  createdAt: ago(45),
});

const thread = (items: Comment[]) => ({ items });

const withComments = withQueryData([
  [commentKeys.productRoots(8, "best", 20), { items: [c1, c4, c5], page: 1, pageSize: 20, total: 3 }],
  [commentKeys.thread(1), thread([c1, c2, c3])],
  [commentKeys.thread(4), thread([c4])],
  [commentKeys.thread(5), thread([c5])],
]);

export const Seccion: Story = {
  name: "Sección completa",
  parameters: { session: sessions.user },
  decorators: [withComments],
  render: () => <CommentsSection productId={8} className="max-w-2xl" />,
};

export const SeccionVisitante: Story = {
  name: "Sección completa: visitante",
  decorators: [withComments],
  render: () => <CommentsSection productId={8} className="max-w-2xl" />,
};

export const SeccionVacia: Story = {
  name: "Sección sin comentarios",
  parameters: { session: sessions.user },
  decorators: [
    withQueryData([[commentKeys.productRoots(8, "best", 20), { items: [], page: 1, pageSize: 20, total: 0 }]]),
  ],
  render: () => <CommentsSection productId={8} className="max-w-2xl" />,
};

const nodeProps = { onLike: noop, onReply: noop, onEdit: noop, onDelete: noop };

export const Comentarios: Story = {
  name: "Comentario: estados",
  parameters: { session: sessions.user },
  render: () => (
    <div className="max-w-2xl space-y-6">
      <CommentNode node={c1} {...nodeProps} />
      <CommentNode node={c3} {...nodeProps} />
      <CommentNode node={{ ...c2, createdAt: ago(2) }} {...nodeProps} />
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
