import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, seedCatalog, sessionHeaders, testEnv } from "./helpers";

/** Baja de cuenta (`DELETE /v1/me`): baja suave que anonimiza la cuenta y conserva la fila y los tickets de soporte. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
let seed: Awaited<ReturnType<typeof seedCatalog>>;
let ana: string;

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
});
afterAll(() => dispose());
beforeEach(async () => {
  await resetD1(d1);
  seed = await seedCatalog(db);
  ana = await createUser(env, db, { name: "Ana", username: "ana", email: "ana@example.com" });
});

const NOW = "2026-10-02T12:00:00.000Z";

async function call(actor: string, path: string, method = "GET", body?: unknown) {
  const headers = new Headers({ "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" });
  for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
}
const deleteMe = (actor: string, confirm = "ana") => call(actor, "/v1/me", "DELETE", { confirm });
const code = async (res: Response) => ApiErrorSchema.parse(await res.json()).error;
const userRow = (id: string) => db.query.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

/** Una organización dueña de la tienda `alfa`, con estos miembros. */
async function orgWithMembers(members: Array<[string, "owner" | "admin" | "editor"]>) {
  const org = await db.query
    .insertInto("organizations")
    .values({ slug: "tienda-alfa", name: "Tienda Alfa", created_at: NOW, updated_at: NOW })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db.query.updateTable("stores").set({ organization_id: org.id }).where("id", "=", seed.alfa).execute();
  for (const [user_id, role] of members) {
    await db.query
      .insertInto("organization_members")
      .values({ organization_id: org.id, user_id, role, created_at: NOW })
      .execute();
  }
  return org.id;
}

describe("confirmación y sesión", () => {
  test("exige sesión y que se escriba el handle", async () => {
    const anon = await app.request("/v1/me", { method: "DELETE", body: JSON.stringify({ confirm: "ana" }) }, env);
    expect(anon.status).toBe(401);

    const wrong = await deleteMe(ana, "otro");
    expect(wrong.status).toBe(400);
    expect((await code(wrong)).code).toBe("confirmation_mismatch");
    expect((await userRow(ana)).deleted_at).toBeNull();
    expect((await call(ana, "/v1/me", "DELETE", {})).status).toBe(400);
  });
});

describe("la baja", () => {
  test("anonimiza la cuenta, cierra sus sesiones y la desvincula de los proveedores", async () => {
    await db.query
      .updateTable("users")
      .set({ bio: "Hola", avatar_source_url: "https://cdn.example.com/a.png", avatar_key: "avatars/ana.webp" })
      .where("id", "=", ana)
      .execute();
    const cookie = await sessionHeaders(env, ana);
    const me = () => app.request("/v1/me", { headers: cookie }, env);
    expect((await me()).status).toBe(200);

    const res = await deleteMe(ana);
    expect(res.status).toBe(204);

    const user = await userRow(ana);
    expect(user).toMatchObject({
      display_name: "Usuario eliminado",
      bio: null,
      avatar_key: null,
      avatar_source_url: null,
      email_verified: 0,
      role: "user",
    });
    expect(user.deleted_at).not.toBeNull();
    expect(user.username).toMatch(/^eliminado_[a-z0-9]{8}$/);
    expect(user.email).toMatch(/@framerate\.invalid$/);
    expect(user.email).not.toContain("ana@example.com");
    expect(await all(db, "auth_sessions")).toEqual([]);
    expect(await all(db, "auth_accounts")).toEqual([]);

    // La misma cookie ya no sirve, el perfil público desaparece y esa cuenta de Google o Discord vuelve a poder registrarse.
    expect((await me()).status).toBe(401);
    expect((await app.request("/v1/users/ana", {}, env)).status).toBe(404);
    expect(await createUser(env, db, { name: "Ana", username: "ana", email: "ana@example.com" })).not.toBe(ana);
  });

  test("despublica lo que escribió: cotizaciones, reseñas y comentarios", async () => {
    const at = NOW;
    await db.query
      .insertInto("quotes")
      .values({
        public_id: "ABCDEFGH23",
        owner_id: ana,
        name: "Mi PC",
        visibility: "public",
        created_at: at,
        updated_at: at,
      })
      .execute();
    const review = await db.query
      .insertInto("store_reviews")
      .values({ store_id: seed.alfa, user_id: ana, rating: 5, body: "Excelente", created_at: at })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db.query
      .insertInto("store_review_votes")
      .values({ review_id: review.id, user_id: ana, created_at: at })
      .execute();
    const comment = await db.query
      .insertInto("comments")
      .values({ product_id: seed.asus, author_id: ana, body: "Buena tarjeta", created_at: at })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db.query
      .insertInto("comment_likes")
      .values({ comment_id: comment.id, user_id: ana, created_at: at })
      .execute();

    expect((await deleteMe(ana)).status).toBe(204);

    expect(await all(db, "quotes")).toEqual([]);
    expect(await all(db, "store_review_votes")).toEqual([]);
    expect(await all(db, "comment_likes")).toEqual([]);
    const [reviewAfter] = await all(db, "store_reviews");
    expect(reviewAfter).toMatchObject({ body: null, deletion_reason: "author", deleted_by: ana, is_pinned: 0 });
    expect(reviewAfter?.deleted_at).not.toBeNull();
    const [commentAfter] = await all(db, "comments");
    expect(commentAfter).toMatchObject({ body: null, deletion_reason: "author", deleted_by: ana });
  });

  test("conserva los tickets de soporte y expira los reclamos de tienda en curso", async () => {
    const at = NOW;
    await db.query
      .insertInto("support_tickets")
      .values({
        public_id: "TICKET0001",
        user_id: ana,
        email: "ana@example.com",
        category: "data_request",
        subject: "Quiero mis datos",
        created_at: at,
        updated_at: at,
        last_message_at: at,
      })
      .execute();
    await db.query
      .insertInto("store_claims")
      .values({
        store_id: seed.beta,
        claimant_id: ana,
        domain: "beta.cl",
        token: "tok-1",
        status: "pending",
        expires_at: "2026-10-09T12:00:00.000Z",
        created_at: at,
        updated_at: at,
      })
      .execute();

    expect((await deleteMe(ana)).status).toBe(204);

    const [ticket] = await all(db, "support_tickets");
    expect(ticket).toMatchObject({ user_id: ana, email: "ana@example.com", subject: "Quiero mis datos" });
    expect((await all(db, "store_claims"))[0]?.status).toBe("expired");
  });
});

describe("tiendas y administradores", () => {
  test("el único dueño de una tienda no puede darse de baja hasta traspasarla", async () => {
    const beto = await createUser(env, db, { name: "Beto", username: "beto" });
    const orgId = await orgWithMembers([[ana, "owner"]]);

    const blocked = await deleteMe(ana);
    expect(blocked.status).toBe(409);
    const error = await code(blocked);
    expect(error.code).toBe("sole_owner");
    expect(error.message).toContain("alfa");
    expect((await userRow(ana)).deleted_at).toBeNull();

    // Con otro dueño sí se puede, y su membresía se va con ella.
    await db.query
      .insertInto("organization_members")
      .values({ organization_id: orgId, user_id: beto, role: "owner", created_at: NOW })
      .execute();
    expect((await deleteMe(ana)).status).toBe(204);
    expect((await all(db, "organization_members")).map((m) => m.user_id)).toEqual([beto]);
  });

  test("un miembro que no es dueño se da de baja sin problema", async () => {
    const beto = await createUser(env, db, { name: "Beto", username: "beto" });
    await orgWithMembers([
      [beto, "owner"],
      [ana, "editor"],
    ]);
    expect((await deleteMe(ana)).status).toBe(204);
  });

  test("el último administrador no puede darse de baja", async () => {
    await db.query.updateTable("users").set({ role: "admin" }).where("id", "=", ana).execute();
    const blocked = await deleteMe(ana);
    expect(blocked.status).toBe(409);
    expect((await code(blocked)).code).toBe("last_admin");

    const beto = await createUser(env, db, { name: "Beto", username: "beto", role: "admin" });
    expect(beto).not.toBe(ana);
    expect((await deleteMe(ana)).status).toBe(204);
  });
});
