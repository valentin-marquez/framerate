import type { Comment, CommentLike, CommentPage, CommentSort } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { sql } from "kysely";
import { avatarUrl } from "@/features/identity/domain/avatar";

/** Una escritura y la lectura del `Comment` resultante viajan en el mismo lote de D1. */

const commentsQuery = (db: Db, viewerId: string | null) =>
  db.query
    .selectFrom("comments as c")
    .leftJoin("users as u", (join) => join.onRef("u.id", "=", "c.author_id").on("u.deleted_at", "is", null))
    .select([
      "c.id",
      "c.product_id",
      "c.parent_id",
      "c.root_id",
      "c.depth",
      "c.body",
      "c.like_count",
      "c.reply_count",
      "c.edited_at",
      "c.deleted_at",
      "c.deletion_reason",
      "c.created_at",
      "u.username",
      "u.display_name",
      "u.avatar_key",
      "u.avatar_source_url",
      viewerId
        ? sql<number>`exists(select 1 from comment_likes l where l.comment_id = c.id and l.user_id = ${viewerId})`.as(
            "liked",
          )
        : sql<number>`0`.as("liked"),
    ]);

type Row = Awaited<ReturnType<ReturnType<typeof commentsQuery>["executeTakeFirstOrThrow"]>>;

function toComment(r: Row, assetsBaseUrl: string | undefined): Comment {
  const showAuthor = r.body !== null && r.username !== null && r.display_name !== null;
  return {
    id: r.id,
    productId: r.product_id,
    parentId: r.parent_id,
    rootId: r.root_id,
    depth: r.depth,
    body: r.body,
    likeCount: r.like_count,
    likedByMe: Boolean(r.liked),
    replyCount: r.parent_id === null ? r.reply_count : 0,
    editedAt: r.edited_at,
    deletedAt: r.deleted_at,
    deletionReason: r.deletion_reason,
    createdAt: r.created_at,
    author: showAuthor
      ? { username: r.username, displayName: r.display_name, avatarUrl: avatarUrl(r, assetsBaseUrl) }
      : null,
  } as Comment;
}

const productExists = (db: Db, productId: number) =>
  db.query.selectFrom("products").select("id").where("id", "=", productId);

export async function listRoots(
  db: Db,
  productId: number,
  sort: CommentSort,
  page: number,
  pageSize: number,
  viewerId: string | null,
  assetsBaseUrl: string | undefined,
): Promise<CommentPage | null> {
  const order = commentsQuery(db, viewerId)
    .where("c.product_id", "=", productId)
    .where("c.parent_id", "is", null)
    .$call((q) =>
      sort === "best"
        ? q.orderBy("c.like_count", "desc").orderBy("c.created_at", "desc")
        : q.orderBy("c.created_at", sort === "recent" ? "desc" : "asc"),
    )
    .orderBy("c.id", sort === "old" ? "asc" : "desc");
  const [product, rows, [totalRow]] = await db.read([
    productExists(db, productId),
    order.limit(pageSize).offset((page - 1) * pageSize),
    db.query
      .selectFrom("comments")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("product_id", "=", productId)
      .where("parent_id", "is", null),
  ]);
  if (!product[0]) return null;
  return { items: rows.map((r) => toComment(r, assetsBaseUrl)), page, pageSize, total: Number(totalRow?.n ?? 0) };
}

/** La raíz y sus respuestas, en orden de lectura. null si `rootId` no es una raíz. */
export async function getThread(db: Db, rootId: number, viewerId: string | null, assetsBaseUrl: string | undefined) {
  const [rows] = await db.read([commentsQuery(db, viewerId).where("c.root_id", "=", rootId).orderBy("c.path")]);
  if (rows[0]?.id !== rootId) return null;
  return { items: rows.map((r) => toComment(r, assetsBaseUrl)) };
}

/** Datos mínimos para decidir permisos antes de escribir. */
export async function loadMeta(db: Db, id: number) {
  return db.query
    .selectFrom("comments")
    .select(["id", "product_id", "depth", "author_id", "deleted_at"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export type CommentMeta = NonNullable<Awaited<ReturnType<typeof loadMeta>>>;

/** Producto y padre (si hay) en un viaje. */
export async function loadCreateContext(db: Db, productId: number, parentId: number | null) {
  const [product, parent] = await db.read([
    productExists(db, productId),
    db.query
      .selectFrom("comments")
      .select(["id", "product_id", "depth", "author_id", "deleted_at"])
      .where("id", "=", parentId ?? -1),
  ]);
  return { productFound: product.length > 0, parent: parent[0] };
}

export async function createComment(
  db: Db,
  input: { productId: number; parentId: number | null; authorId: string; body: string },
  assetsBaseUrl: string | undefined,
  now: string,
) {
  const [, [row]] = await db.read([
    db.query.insertInto("comments").values({
      product_id: input.productId,
      parent_id: input.parentId,
      author_id: input.authorId,
      body: input.body,
      created_at: now,
    }),
    // last_insert_rowid() no cambia por los UPDATE de los triggers.
    commentsQuery(db, input.authorId).where(sql<boolean>`c.id = last_insert_rowid()`),
  ]);
  if (!row) throw new Error("El comentario recién creado no se encontró");
  return toComment(row, assetsBaseUrl);
}

export async function editComment(
  db: Db,
  id: number,
  viewerId: string,
  body: string,
  assetsBaseUrl: string | undefined,
  now: string,
) {
  const [, [row]] = await db.read([
    db.query.updateTable("comments").set({ body, edited_at: now }).where("id", "=", id).where("deleted_at", "is", null),
    commentsQuery(db, viewerId).where("c.id", "=", id),
  ]);
  return row ? toComment(row, assetsBaseUrl) : null;
}

export async function deleteComment(
  db: Db,
  id: number,
  by: string,
  reason: "author" | "moderation",
  viewerId: string,
  assetsBaseUrl: string | undefined,
  now: string,
) {
  const [, [row]] = await db.read([
    db.query
      .updateTable("comments")
      .set({ body: null, deleted_at: now, deleted_by: by, deletion_reason: reason })
      .where("id", "=", id)
      .where("deleted_at", "is", null),
    commentsQuery(db, viewerId).where("c.id", "=", id),
  ]);
  return row ? toComment(row, assetsBaseUrl) : null;
}

const likeState = (db: Db, id: number) =>
  db.query.selectFrom("comments").select(["like_count", "deleted_at"]).where("id", "=", id);

/** `not_found` / `deleted` si no se puede dar "me gusta"; idempotente si ya lo había dado. */
export async function likeComment(
  db: Db,
  id: number,
  userId: string,
  now: string,
): Promise<CommentLike | "not_found" | "deleted"> {
  const [, [row]] = await db.read([
    db.query
      .insertInto("comment_likes")
      .columns(["comment_id", "user_id", "created_at"])
      .expression(
        db.query
          .selectFrom("comments")
          .select(["id as comment_id", sql.val(userId).as("user_id"), sql.val(now).as("created_at")])
          .where("id", "=", id)
          .where("deleted_at", "is", null),
      )
      .onConflict((oc) => oc.doNothing()),
    likeState(db, id),
  ]);
  if (!row) return "not_found";
  if (row.deleted_at) return "deleted";
  return { likeCount: row.like_count, likedByMe: true };
}

export async function unlikeComment(db: Db, id: number, userId: string): Promise<CommentLike | null> {
  const [, [row]] = await db.read([
    db.query.deleteFrom("comment_likes").where("comment_id", "=", id).where("user_id", "=", userId),
    likeState(db, id),
  ]);
  return row ? { likeCount: row.like_count, likedByMe: false } : null;
}
