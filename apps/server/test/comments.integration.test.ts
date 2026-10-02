import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  ApiErrorSchema,
  CommentLikeSchema,
  CommentPageSchema,
  CommentSchema,
  CommentThreadSchema,
} from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, seedCatalog, sessionHeaders, testEnv } from "./helpers";

/** Comentarios: hilos, permisos de autor y moderación, borrado lógico, "me gusta" idempotente y sanciones. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
let ana: string;
let beto: string;
let mod: string;
let seed: Awaited<ReturnType<typeof seedCatalog>>;

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
});
afterAll(() => dispose());
beforeEach(async () => {
  await resetD1(d1);
  seed = await seedCatalog(db);
  ana = await createUser(env, db, { name: "Ana", username: "ana" });
  beto = await createUser(env, db, { name: "Beto", username: "beto" });
  mod = await createUser(env, db, { name: "Mod", username: "mod", role: "moderator" });
});

async function call(actor: string, path: string, method = "GET", body?: unknown) {
  const headers = new Headers({ "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" });
  if (actor !== "anon") for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
}
const code = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

async function post(actor: string, body: string, parentId?: number, productId = seed.asus) {
  const res = await call(actor, `/v1/products/${productId}/comments`, "POST", { body, parentId });
  expect(res.status).toBe(201);
  return CommentSchema.parse(await res.json());
}
const thread = async (actor: string, rootId: number) =>
  CommentThreadSchema.parse(await (await call(actor, `/v1/comments/${rootId}/thread`)).json()).items;

describe("crear y leer", () => {
  test("una raíz y una respuesta: árbol, autor y reply_count en la raíz", async () => {
    expect((await call("anon", `/v1/products/${seed.asus}/comments`, "POST", { body: "x" })).status).toBe(401);

    const root = await post(ana, "  Buen precio  ");
    expect(root).toMatchObject({
      body: "Buen precio",
      parentId: null,
      rootId: root.id,
      depth: 0,
      replyCount: 0,
      likedByMe: false,
      author: { username: "ana", displayName: "Ana" },
    });
    const reply = await post(beto, "Concuerdo", root.id);
    expect(reply).toMatchObject({ parentId: root.id, rootId: root.id, depth: 1, replyCount: 0 });

    const page = CommentPageSchema.parse(await (await call("anon", `/v1/products/${seed.asus}/comments`)).json());
    expect(page.total).toBe(1);
    expect(page.items.map((c) => [c.id, c.replyCount])).toEqual([[root.id, 1]]);
    expect((await thread("anon", root.id)).map((c) => c.id)).toEqual([root.id, reply.id]);
    expect((await call("anon", `/v1/comments/${reply.id}/thread`)).status).toBe(404);
    expect((await call("anon", "/v1/products/9999/comments")).status).toBe(404);
  });

  test("el padre debe ser del mismo producto, no estar borrado y respetar la profundidad", async () => {
    const root = await post(ana, "raíz");
    const other = await call(ana, `/v1/products/${seed.msi}/comments`, "POST", { body: "x", parentId: root.id });
    expect(other.status).toBe(422);

    let parent = root;
    for (let i = 0; i < 10; i++) parent = await post(ana, `n${i}`, parent.id);
    const tooDeep = await call(ana, `/v1/products/${seed.asus}/comments`, "POST", { body: "x", parentId: parent.id });
    expect(tooDeep.status).toBe(422);
    expect(await code(tooDeep)).toBe("max_depth");

    await call(ana, `/v1/comments/${root.id}`, "DELETE");
    const underDeleted = await call(ana, `/v1/products/${seed.asus}/comments`, "POST", {
      body: "x",
      parentId: root.id,
    });
    expect(underDeleted.status).toBe(409);
  });

  test("orden: best por me gusta, recent y old por fecha", async () => {
    const a = await post(ana, "a");
    const b = await post(ana, "b");
    await call(beto, `/v1/comments/${a.id}/like`, "PUT");
    const ids = async (sort: string) =>
      CommentPageSchema.parse(await (await call(beto, `/v1/products/${seed.asus}/comments?sort=${sort}`)).json()).items;
    expect((await ids("best")).map((c) => c.id)).toEqual([a.id, b.id]);
    expect((await ids("recent")).map((c) => c.id)).toEqual([b.id, a.id]);
    expect((await ids("old")).map((c) => c.id)).toEqual([a.id, b.id]);
    expect((await ids("best"))[0]).toMatchObject({ likeCount: 1, likedByMe: true });
  });
});

describe("editar y borrar", () => {
  test("sólo el autor edita; el comentario queda marcado como editado", async () => {
    const root = await post(ana, "original");
    expect((await call(beto, `/v1/comments/${root.id}`, "PATCH", { body: "hack" })).status).toBe(403);
    const res = await call(ana, `/v1/comments/${root.id}`, "PATCH", { body: "corregido" });
    expect(res.status).toBe(200);
    const edited = CommentSchema.parse(await res.json());
    expect(edited.body).toBe("corregido");
    expect(edited.editedAt).not.toBeNull();
  });

  test("el borrado lógico conserva el hilo y reply_count; moderación queda registrada", async () => {
    const root = await post(ana, "raíz");
    const reply = await post(beto, "respuesta", root.id);
    const sibling = await post(ana, "otra", root.id);

    expect((await call(ana, `/v1/comments/${reply.id}`, "DELETE")).status).toBe(403);
    const byMod = CommentSchema.parse(await (await call(mod, `/v1/comments/${reply.id}`, "DELETE")).json());
    expect(byMod).toMatchObject({ body: null, author: null, deletionReason: "moderation" });
    const byAuthor = CommentSchema.parse(await (await call(ana, `/v1/comments/${root.id}`, "DELETE")).json());
    expect(byAuthor).toMatchObject({ body: null, deletionReason: "author", replyCount: 1 });

    const items = await thread("anon", root.id);
    expect(items.map((c) => c.id)).toEqual([root.id, reply.id, sibling.id]);
    expect(items[2]?.body).toBe("otra");
    expect((await call(ana, `/v1/comments/${root.id}`, "PATCH", { body: "x" })).status).toBe(409);
  });
});

describe("me gusta", () => {
  test("PUT y DELETE son idempotentes y no se da a un borrado", async () => {
    const root = await post(ana, "raíz");
    const like = async (method: string) =>
      CommentLikeSchema.parse(await (await call(beto, `/v1/comments/${root.id}/like`, method)).json());
    expect(await like("PUT")).toEqual({ likeCount: 1, likedByMe: true });
    expect(await like("PUT")).toEqual({ likeCount: 1, likedByMe: true });
    expect(await like("DELETE")).toEqual({ likeCount: 0, likedByMe: false });
    expect(await like("DELETE")).toEqual({ likeCount: 0, likedByMe: false });
    expect((await call("anon", `/v1/comments/${root.id}/like`, "PUT")).status).toBe(401);
    expect((await call(beto, "/v1/comments/999/like", "PUT")).status).toBe(404);

    await call(ana, `/v1/comments/${root.id}`, "DELETE");
    expect((await call(beto, `/v1/comments/${root.id}/like`, "PUT")).status).toBe(409);
  });
});

describe("sanciones", () => {
  test("un usuario sancionado no escribe", async () => {
    await db.query
      .insertInto("user_bans")
      .values({ user_id: beto, reason: "spam", banned_by: mod, created_at: new Date().toISOString() })
      .execute();
    const res = await call(beto, `/v1/products/${seed.asus}/comments`, "POST", { body: "spam" });
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("banned");
  });
});
