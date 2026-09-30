import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  ApiErrorSchema,
  RatingStatsSchema,
  ReviewListSchema,
  StoreDetailSchema,
  StoreProductsSchema,
} from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, seedCatalog, sessionHeaders, testEnv, WEB_ORIGIN } from "./helpers";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

async function call(actor: string | "anon", path: string, method = "GET", body?: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  if (actor !== "anon") {
    for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
    headers.set("origin", WEB_ORIGIN);
  }
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
}

const who = (name: string, role: "user" | "moderator" | "admin" = "user") => createUser(env, db, { name, role });
const code = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;
const at = "2026-01-01T00:00:00Z";

async function ownedStore(slug = "alfa") {
  await seedCatalog(db);
  const owner = await who("Duena");
  const org = await db.query
    .insertInto("organizations")
    .values({ slug: "org", name: "Org", created_at: at, updated_at: at })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db.query
    .insertInto("organization_members")
    .values({ organization_id: org.id, user_id: owner, role: "owner", created_at: at })
    .execute();
  await db.query.updateTable("stores").set({ organization_id: org.id }).where("slug", "=", slug).execute();
  return owner;
}

const review = async (user: string, rating: number, comment?: string) => {
  const res = await call(user, "/v1/stores/alfa/reviews", "POST", { rating, comment });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: number }).id;
};

describe("detalle de tienda", () => {
  test("público, con nombre editado y promedio", async () => {
    await seedCatalog(db);
    await db.query
      .insertInto("store_profiles")
      .values({
        store_id: 1,
        display_name: "Alfa Store",
        social: JSON.stringify({ instagram: "alfa" }),
        updated_at: at,
      })
      .execute();
    await review(await who("Ana"), 5);
    await review(await who("Beto"), 4);
    const store = StoreDetailSchema.parse(await (await call("anon", "/v1/stores/alfa")).json());
    expect(store).toMatchObject({ name: "Alfa Store", canonicalName: "alfa", isClaimed: false, offerCount: 3 });
    expect(store.social).toEqual({ instagram: "alfa" });
    expect(store.rating).toMatchObject({ average: 4.5, count: 2, recent: { average: 4.5, count: 2 } });
  });

  test("productos de la tienda agrupados por categoría", async () => {
    await seedCatalog(db);
    const res = StoreProductsSchema.parse(await (await call("anon", "/v1/stores/alfa/products")).json());
    expect(res.total).toBe(3);
    expect(res.categories.map((c) => [c.category, c.count])).toEqual([
      ["gpu", 2],
      ["cpu", 1],
    ]);
    expect(res.categories[0]?.items.map((p) => p.slug).sort()).toEqual([
      "asus-dual-rtx-4070-super-oc-12gb",
      "msi-rtx-4060-ventus-2x-8gb",
    ]);
  });

  test("tienda inexistente → 404", async () => {
    expect((await call("anon", "/v1/stores/nada")).status).toBe(404);
  });
});

describe("reseñas", () => {
  test("crear exige sesión y una sola reseña activa por usuario", async () => {
    await seedCatalog(db);
    const ana = await who("Ana");
    expect((await call("anon", "/v1/stores/alfa/reviews", "POST", { rating: 5 })).status).toBe(401);
    expect((await call(ana, "/v1/stores/alfa/reviews", "POST", { rating: 6 })).status).toBe(400);
    await review(ana, 5, "  Excelente  ");
    const dup = await call(ana, "/v1/stores/alfa/reviews", "POST", { rating: 3 });
    expect(dup.status).toBe(409);
    expect(await code(dup)).toBe("already_reviewed");
  });

  test("el usuario sancionado no puede publicar", async () => {
    await seedCatalog(db);
    const ana = await who("Ana");
    await db.query.insertInto("user_bans").values({ user_id: ana, reason: "spam", created_at: at }).execute();
    const res = await call(ana, "/v1/stores/alfa/reviews", "POST", { rating: 5 });
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("banned");
  });

  test("quien administra la tienda no puede reseñarla", async () => {
    const owner = await ownedStore();
    expect(await code(await call(owner, "/v1/stores/alfa/reviews", "POST", { rating: 5 }))).toBe("own_store");
  });

  test("lista con autor, mine y votedByMe; ordena por útiles", async () => {
    await seedCatalog(db);
    const [ana, beto] = [await who("Ana"), await who("Beto")];
    const a = await review(ana, 2, "regular");
    const b = await review(beto, 5, "top");
    expect((await call(ana, `/v1/reviews/${b}/helpful`, "PUT")).status).toBe(204);
    expect((await call(ana, `/v1/reviews/${a}/helpful`, "PUT")).status).toBe(403);

    const list = ReviewListSchema.parse(await (await call(ana, "/v1/stores/alfa/reviews?sort=helpful")).json());
    expect(list.total).toBe(2);
    const [first, second] = list.items;
    expect(first).toMatchObject({ id: b, helpfulCount: 1, votedByMe: true, mine: false });
    expect(second).toMatchObject({ id: a, mine: true });

    await call(ana, `/v1/reviews/${b}/helpful`, "DELETE");
    const after = ReviewListSchema.parse(await (await call("anon", "/v1/stores/alfa/reviews?sort=helpful")).json());
    expect(after.items[0]).toMatchObject({ helpfulCount: 0, votedByMe: false });
  });

  test("estadísticas: distribución y promedio, sin contar las eliminadas", async () => {
    await seedCatalog(db);
    const [ana, beto] = [await who("Ana"), await who("Beto")];
    await review(ana, 5);
    const b = await review(beto, 1);
    await call(beto, `/v1/reviews/${b}`, "DELETE");
    const stats = RatingStatsSchema.parse(await (await call("anon", "/v1/stores/alfa/reviews/stats")).json());
    expect(stats).toMatchObject({ average: 5, total: 1, distribution: { 1: 0, 5: 1 } });
    const list = ReviewListSchema.parse(await (await call("anon", "/v1/stores/alfa/reviews")).json());
    expect(list.items.find((i) => i.id === b)).toMatchObject({ deleted: true, reason: "author" });
  });

  test("sólo el autor edita; el dueño responde y fija; nadie más", async () => {
    const owner = await ownedStore();
    const [ana, beto] = [await who("Ana"), await who("Beto")];
    const id = await review(ana, 2, "lento");

    expect((await call(beto, `/v1/reviews/${id}`, "PATCH", { rating: 5 })).status).toBe(403);
    expect((await call(ana, `/v1/reviews/${id}`, "PATCH", { ownerResponse: "gracias" })).status).toBe(403);
    expect((await call(ana, `/v1/reviews/${id}`, "PATCH", { rating: 3 })).status).toBe(204);
    const managed = await call(owner, `/v1/reviews/${id}`, "PATCH", {
      ownerResponse: " Lo revisamos ",
      isPinned: true,
    });
    expect(managed.status).toBe(204);

    const list = ReviewListSchema.parse(await (await call("anon", "/v1/stores/alfa/reviews")).json());
    expect(list.items[0]).toMatchObject({ rating: 3, ownerResponse: "Lo revisamos", isPinned: true });

    await db.query.updateTable("stores").set({ frozen_at: at }).where("slug", "=", "alfa").execute();
    expect((await call(owner, `/v1/reviews/${id}`, "PATCH", { ownerResponse: "otra" })).status).toBe(403);
  });

  test("eliminar: el autor y el personal sí (con auditoría); otro usuario no", async () => {
    await seedCatalog(db);
    const [ana, beto, mod] = [await who("Ana"), await who("Beto"), await who("Mod", "moderator")];
    const id = await review(ana, 1, "malo");
    expect((await call(beto, `/v1/reviews/${id}`, "DELETE")).status).toBe(403);
    expect((await call(mod, `/v1/reviews/${id}`, "DELETE", { reason: "insultos" })).status).toBe(204);
    const actions = await db.query.selectFrom("moderation_actions").select(["action", "reason"]).execute();
    expect(actions).toEqual([{ action: "review_removed", reason: "insultos" }]);
    const list = ReviewListSchema.parse(await (await call("anon", "/v1/stores/alfa/reviews")).json());
    expect(list.items[0]).toMatchObject({ deleted: true, reason: "moderation" });
    expect((await call(ana, "/v1/stores/alfa/reviews", "POST", { rating: 4 })).status).toBe(201);
  });

  test("/stores/:slug/me devuelve el rol en la organización", async () => {
    const owner = await ownedStore();
    const ana = await who("Ana");
    expect((await (await call(owner, "/v1/stores/alfa/me")).json()) as unknown).toEqual({ role: "owner" });
    expect((await (await call(ana, "/v1/stores/alfa/me")).json()) as unknown).toEqual({ role: null });
  });
});
