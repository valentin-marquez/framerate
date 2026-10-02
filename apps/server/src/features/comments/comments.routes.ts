import {
  COMMENT_MAX_DEPTH,
  CommentListQuerySchema,
  CreateCommentRequestSchema,
  hasRole,
  UpdateCommentRequestSchema,
} from "@framerate/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { currentUser } from "@/features/identity/middleware";
import { assertNotBanned } from "@/features/identity/policies";
import { AppError } from "@/shared/http/errors";
import {
  createComment,
  deleteComment,
  editComment,
  getThread,
  likeComment,
  listRoots,
  loadCreateContext,
  loadMeta,
  unlikeComment,
} from "./comments.repository";

/**
 * `/v1/products/:id/comments` y `/v1/comments/*` (se montan bajo `optionalUser`). Leer no exige sesión; escribir sí.
 * Editar un comentario ajeno responde 403 y borrar uno ajeno sin ser personal también; uno inexistente, 404.
 */

const IdSchema = z.coerce.number().int().positive();
const notFound = () => new AppError(404, "comment_not_found", "Comentario no encontrado");
const deleted = () => new AppError(409, "comment_deleted", "El comentario fue eliminado");
const productId = (raw: string) => {
  const id = IdSchema.safeParse(raw);
  if (!id.success) throw new AppError(404, "product_not_found", "Producto no encontrado");
  return id.data;
};
const commentId = (raw: string) => {
  const id = IdSchema.safeParse(raw);
  if (!id.success) throw notFound();
  return id.data;
};
const body = (c: { req: { json(): Promise<unknown> } }) => c.req.json().catch(() => ({}));

export const productCommentsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const query = CommentListQuerySchema.parse(c.req.query());
    const page = await listRoots(
      c.var.db,
      productId(c.req.param("id") ?? ""),
      query.sort,
      query.page,
      query.pageSize,
      c.get("user")?.id ?? null,
      c.env.ASSETS_BASE_URL,
    );
    if (!page) throw new AppError(404, "product_not_found", "Producto no encontrado");
    return c.json(page);
  })
  .post("/", async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const input = CreateCommentRequestSchema.parse(await body(c));
    const pid = productId(c.req.param("id") ?? "");
    const parentId = input.parentId ?? null;
    const { productFound, parent } = await loadCreateContext(c.var.db, pid, parentId);
    if (!productFound) throw new AppError(404, "product_not_found", "Producto no encontrado");
    if (parentId !== null) {
      if (!parent || parent.product_id !== pid) {
        throw new AppError(422, "invalid_parent", "El comentario al que respondes no es de este producto");
      }
      if (parent.deleted_at) throw new AppError(409, "parent_deleted", "El comentario al que respondes fue eliminado");
      if (parent.depth >= COMMENT_MAX_DEPTH)
        throw new AppError(422, "max_depth", "El hilo alcanzó su profundidad máxima");
    }
    try {
      const comment = await createComment(
        c.var.db,
        { productId: pid, parentId, authorId: user.id, body: input.body },
        c.env.ASSETS_BASE_URL,
        new Date().toISOString(),
      );
      return c.json(comment, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes("parent_product_mismatch")) {
        throw new AppError(422, "invalid_parent", "El comentario al que respondes no es de este producto");
      }
      throw error;
    }
  });

export const commentsRoutes = new Hono<AppEnv>()
  .get("/:rootId/thread", async (c) => {
    const thread = await getThread(
      c.var.db,
      commentId(c.req.param("rootId")),
      c.get("user")?.id ?? null,
      c.env.ASSETS_BASE_URL,
    );
    if (!thread) throw notFound();
    return c.json(thread);
  })
  .patch("/:id", async (c) => {
    const user = currentUser(c);
    const input = UpdateCommentRequestSchema.parse(await body(c));
    const id = commentId(c.req.param("id"));
    const meta = await loadMeta(c.var.db, id);
    if (!meta) throw notFound();
    if (meta.author_id !== user.id) throw new AppError(403, "forbidden", "Sólo quien lo escribió puede editarlo");
    if (meta.deleted_at) throw deleted();
    assertNotBanned(user);
    const comment = await editComment(
      c.var.db,
      id,
      user.id,
      input.body,
      c.env.ASSETS_BASE_URL,
      new Date().toISOString(),
    );
    if (!comment) throw notFound();
    return c.json(comment);
  })
  .delete("/:id", async (c) => {
    const user = currentUser(c);
    const id = commentId(c.req.param("id"));
    const meta = await loadMeta(c.var.db, id);
    if (!meta) throw notFound();
    const isAuthor = meta.author_id === user.id;
    if (!isAuthor && !hasRole(user.role, "moderator")) {
      throw new AppError(403, "forbidden", "No tienes permisos para eliminar este comentario");
    }
    const comment = await deleteComment(
      c.var.db,
      id,
      user.id,
      isAuthor ? "author" : "moderation",
      user.id,
      c.env.ASSETS_BASE_URL,
      new Date().toISOString(),
    );
    if (!comment) throw notFound();
    return c.json(comment);
  })
  .put("/:id/like", async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const result = await likeComment(c.var.db, commentId(c.req.param("id")), user.id, new Date().toISOString());
    if (result === "not_found") throw notFound();
    if (result === "deleted") throw deleted();
    return c.json(result);
  })
  .delete("/:id/like", async (c) => {
    const result = await unlikeComment(c.var.db, commentId(c.req.param("id")), currentUser(c).id);
    if (!result) throw notFound();
    return c.json(result);
  });
