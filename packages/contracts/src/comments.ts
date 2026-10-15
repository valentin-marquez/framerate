import { z } from "zod";
import { pageSchema } from "./catalog";
import { COMMENT_MAX_LENGTH } from "./comment-limits";

/**
 * Comentarios de producto: `/v1/products/:id/comments` y `/v1/comments/*`. Hilos de hasta 10 niveles; sólo hay
 * "me gusta". Un comentario borrado conserva su lugar en el hilo con `body: null`. Las lecturas aceptan sesión
 * opcional (`likedByMe` es false sin ella); escribir exige sesión y no estar sancionado. `DELETE /v1/comments/:id` es
 * borrado lógico: el autor lo borra con reason "author" y el personal con "moderation"; devuelve el `Comment`.
 */

export * from "./comment-limits";

export const CommentSortSchema = z.enum(["best", "recent", "old"]);
export type CommentSort = z.infer<typeof CommentSortSchema>;

export const CommentAuthorSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.url().nullable(),
});

export const CommentSchema = z.object({
  id: z.number().int(),
  productId: z.number().int(),
  parentId: z.number().int().nullable(),
  rootId: z.number().int(),
  depth: z.number().int(),
  /** null si está borrado. */
  body: z.string().nullable(),
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
  /** Sólo en raíces: respuestas no borradas de todo el hilo. En las demás, 0. */
  replyCount: z.number().int(),
  editedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  /** author: lo borró quien lo escribió; moderation: lo borró el personal. */
  deletionReason: z.enum(["author", "moderation"]).nullable(),
  createdAt: z.iso.datetime(),
  /** null si está borrado o la cuenta se dio de baja. */
  author: CommentAuthorSchema.nullable(),
});
export type Comment = z.infer<typeof CommentSchema>;

/** `GET /v1/products/:id/comments`: sólo raíces. */
export const CommentListQuerySchema = z.object({
  sort: CommentSortSchema.default("best"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type CommentListQuery = z.infer<typeof CommentListQuerySchema>;

export const CommentPageSchema = pageSchema(CommentSchema);
export type CommentPage = z.infer<typeof CommentPageSchema>;

/** `GET /v1/comments/:rootId/thread`: la raíz y todas sus respuestas, en orden de lectura (por `path`). */
export const CommentThreadSchema = z.object({ items: z.array(CommentSchema) });
export type CommentThread = z.infer<typeof CommentThreadSchema>;

const CommentBodySchema = z.string().trim().min(1).max(COMMENT_MAX_LENGTH);

/** `POST /v1/products/:id/comments`. Sin `parentId` crea una raíz. Devuelve el `Comment` creado (201). */
export const CreateCommentRequestSchema = z.object({
  parentId: z.number().int().positive().nullable().optional(),
  body: CommentBodySchema,
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

/** `PATCH /v1/comments/:id`: sólo el autor, y sólo si no está borrado. Devuelve el `Comment`. */
export const UpdateCommentRequestSchema = z.object({ body: CommentBodySchema });
export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequestSchema>;

/** `PUT` y `DELETE /v1/comments/:id/like`: idempotentes. */
export const CommentLikeSchema = z.object({
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
});
export type CommentLike = z.infer<typeof CommentLikeSchema>;
