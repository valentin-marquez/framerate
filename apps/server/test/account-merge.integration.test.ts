import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema, MergePreviewSchema, MeSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { USER_REFERENCES } from "@/features/identity/merge.repository";
import { createUser, daysAgo, seedCatalog, sessionHeaders, testEnv, WEB_ORIGIN } from "./helpers";

/** Unión de dos usuarios de punta a punta (D1 real): A inicia, B (la sesión) confirma y queda absorbido en A. */

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

/** Cookie de una sesión nueva de `userId`. */
const sessionOf = async (userId: string) => (await sessionHeaders(env, userId)).get("cookie") ?? "";

const call = (session: string, path: string, method = "GET", extra: { merge?: string; origin?: string } = {}) =>
  app.request(
    path,
    {
      method,
      headers: {
        origin: extra.origin ?? WEB_ORIGIN,
        cookie: [session, extra.merge].filter(Boolean).join("; "),
      },
    },
    env,
  );

/** A inicia la unión; devuelve la cookie `framerate.merge=…` que el navegador guardaría. */
async function start(sessionA: string) {
  const res = await call(sessionA, "/v1/me/merge/start", "POST");
  expect(res.status).toBe(204);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("framerate.merge="));
  if (!cookie) throw new Error("sin cookie de unión");
  return { merge: cookie.split(";")[0] ?? "", header: cookie };
}

const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;
const userRow = (id: string) => db.query.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();

async function twoUsers() {
  const a = await createUser(env, db, {
    name: "Ana",
    email: "ana@gmail.com",
    image: "https://cdn.discordapp.com/a.png",
  });
  const b = await createUser(env, db, { name: "Beto", email: "ana.otra@gmail.com", username: "beto" });
  await db.query.updateTable("auth_accounts").set({ provider_id: "google" }).where("user_id", "=", b).execute();
  return { a, b, sessionA: await sessionOf(a), sessionB: await sessionOf(b) };
}

describe("iniciar y cancelar", () => {
  test("start guarda sólo el hash del token y deja una cookie httpOnly de 10 minutos", async () => {
    const { sessionA, a } = await twoUsers();
    const { merge, header } = await start(sessionA);
    expect(header).toContain("Max-Age=600");
    expect(header).toContain("Path=/");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");

    const token = merge.split("=")[1] ?? "";
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const [row] = await all(db, "account_merges");
    expect(row).toMatchObject({ survivor_id: a, status: "pending", absorbed_id: null });
    expect(row?.token_hash).not.toBe(token);
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);

    // Empezar otra vez reemplaza la anterior.
    await start(sessionA);
    expect(await all(db, "account_merges")).toHaveLength(1);
  });

  test("start desde otro origen → 403", async () => {
    const { sessionA } = await twoUsers();
    const res = await call(sessionA, "/v1/me/merge/start", "POST", { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("bad_origin");
    expect(await all(db, "account_merges")).toHaveLength(0);
  });

  test("sin sesión → 401", async () => {
    expect((await call("", "/v1/me/merge/start", "POST")).status).toBe(401);
  });

  test("cancelar borra la fila pendiente y la cookie", async () => {
    const { sessionA, sessionB } = await twoUsers();
    const { merge } = await start(sessionA);
    const res = await call(sessionB, "/v1/me/merge", "DELETE", { merge });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie().find((c) => c.startsWith("framerate.merge="))).toContain("Max-Age=0");
    expect(await all(db, "account_merges")).toHaveLength(0);
    expect(await errorCode(await call(sessionB, "/v1/me/merge", "GET", { merge }))).toBe("merge_not_found");
  });
});

describe("previsualización y errores", () => {
  test("muestra quién se queda, quién se absorbe y qué se mueve", async () => {
    const { a, b, sessionA, sessionB } = await twoUsers();
    const { alfa, asus } = await seedCatalog(db);
    await db.query
      .insertInto("store_reviews")
      .values({ store_id: alfa, user_id: b, rating: 4, created_at: daysAgo(1) })
      .execute();
    await db.query
      .insertInto("comments")
      .values({ product_id: asus, author_id: b, body: "buena", created_at: daysAgo(1) })
      .execute();
    await db.query
      .insertInto("quotes")
      .values({ public_id: "quote-b-01", owner_id: b, name: "Mi PC", created_at: daysAgo(1), updated_at: daysAgo(1) })
      .execute();

    const { merge } = await start(sessionA);
    const res = await call(sessionB, "/v1/me/merge", "GET", { merge });
    expect(res.status).toBe(200);
    expect(MergePreviewSchema.parse(await res.json())).toEqual({
      survivor: {
        username: "ana",
        displayName: "Ana",
        avatarUrl: "https://cdn.discordapp.com/a.png",
        providers: ["discord"],
      },
      absorbed: { username: "beto", displayName: "Beto", avatarUrl: null, providers: ["google"] },
      counts: { reviews: 1, comments: 1, organizations: 0, claims: 0, quotes: 1, tickets: 0 },
    });
    // Previsualizar no cambia nada.
    expect(await userRow(b)).toBeDefined();
    expect((await all(db, "account_merges"))[0]).toMatchObject({ survivor_id: a, status: "pending" });
  });

  test("sin cookie, token ajeno, vencido o la misma persona: no fusiona", async () => {
    const { a, b, sessionA, sessionB } = await twoUsers();
    const { merge } = await start(sessionA);
    const forged = `framerate.merge=${"0".repeat(64)}`;

    for (const method of ["GET", "POST"] as const) {
      const path = method === "GET" ? "/v1/me/merge" : "/v1/me/merge/confirm";
      const none = await call(sessionB, path, method);
      expect([none.status, await errorCode(none)]).toEqual([404, "merge_not_found"]);
      const other = await call(sessionB, path, method, { merge: forged });
      expect([other.status, await errorCode(other)]).toEqual([404, "merge_not_found"]);
      const same = await call(sessionA, path, method, { merge });
      expect([same.status, await errorCode(same)]).toEqual([409, "merge_same_user"]);
    }

    await db.query
      .updateTable("account_merges")
      .set({ expires_at: daysAgo(0) })
      .execute();
    for (const [method, path] of [
      ["GET", "/v1/me/merge"],
      ["POST", "/v1/me/merge/confirm"],
    ] as const) {
      const expired = await call(sessionB, path, method, { merge });
      expect([expired.status, await errorCode(expired)]).toEqual([410, "merge_expired"]);
    }
    expect(await userRow(a)).toBeDefined();
    expect(await userRow(b)).toBeDefined();
  });

  test("si A se eliminó mientras tanto → merge_not_found", async () => {
    const { a, sessionA, sessionB } = await twoUsers();
    const { merge } = await start(sessionA);
    await db.query
      .updateTable("users")
      .set({ deleted_at: daysAgo(0) })
      .where("id", "=", a)
      .execute();
    expect(await errorCode(await call(sessionB, "/v1/me/merge/confirm", "POST", { merge }))).toBe("merge_not_found");
  });

  test("confirmar desde otro origen → 403 y nada cambia", async () => {
    const { b, sessionA, sessionB } = await twoUsers();
    const { merge } = await start(sessionA);
    const res = await call(sessionB, "/v1/me/merge/confirm", "POST", { merge, origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(await userRow(b)).toBeDefined();
  });
});

describe("confirmar", () => {
  test("mueve todo lo de B a A, resuelve choques y borra a B", async () => {
    const { a, b, sessionA, sessionB } = await twoUsers();
    const c = await createUser(env, db, { name: "Carla", email: "carla@x.cl" });
    await db.query.updateTable("users").set({ email_verified: 0 }).where("id", "=", a).execute();
    const bCreatedAt = daysAgo(400);
    await db.query
      .updateTable("users")
      .set({ role: "moderator", created_at: bCreatedAt, bio: "de B" })
      .where("id", "=", b)
      .execute();
    const anaBefore = await userRow(a);

    const { alfa, beta, asus } = await seedCatalog(db);
    const review = async (store: number, user: string, rating: number, days: number) =>
      (
        await db.query
          .insertInto("store_reviews")
          .values({ store_id: store, user_id: user, rating, created_at: daysAgo(days) })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;
    // Reseñas en alfa de ambos (choque: queda la de B, más reciente); B en beta sin choque; C en beta.
    const alfaA = await review(alfa, a, 5, 10);
    const alfaB = await review(alfa, b, 1, 2);
    const betaB = await review(beta, b, 4, 3);
    const betaC = await review(beta, c, 3, 5);
    for (const user of [a, b]) {
      await db.query
        .insertInto("store_review_votes")
        .values({ review_id: betaC, user_id: user, created_at: daysAgo(1) })
        .execute();
    }

    const comment = async (author: string) =>
      (
        await db.query
          .insertInto("comments")
          .values({ product_id: asus, author_id: author, body: `de ${author}`, created_at: daysAgo(4) })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;
    const commentB = await comment(b);
    const commentC = await comment(c);
    for (const user of [a, b]) {
      await db.query
        .insertInto("comment_likes")
        .values({ comment_id: commentC, user_id: user, created_at: daysAgo(1) })
        .execute();
      await db.query
        .insertInto("reports")
        .values({
          target_type: "comment",
          target_id: String(commentC),
          reporter_id: user,
          reason: "spam",
          created_at: daysAgo(1),
        })
        .execute();
    }

    const org = async (slug: string) =>
      (
        await db.query
          .insertInto("organizations")
          .values({ slug, name: slug, created_at: daysAgo(9), updated_at: daysAgo(9) })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;
    const shared = await org("compartida");
    const onlyB = await org("solo-b");
    await db.query
      .insertInto("organization_members")
      .values([
        { organization_id: shared, user_id: a, role: "editor", created_at: daysAgo(9) },
        { organization_id: shared, user_id: b, role: "owner", created_at: daysAgo(9) },
        { organization_id: onlyB, user_id: b, role: "admin", invited_by: c, created_at: daysAgo(9) },
      ])
      .execute();

    await db.query
      .insertInto("store_claims")
      .values({
        store_id: beta,
        claimant_id: b,
        domain: "beta.cl",
        token: "tok-b",
        expires_at: daysAgo(-5),
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
      })
      .execute();
    await db.query
      .insertInto("quotes")
      .values({ public_id: "quote-b-01", owner_id: b, name: "Mi PC", created_at: daysAgo(1), updated_at: daysAgo(1) })
      .execute();
    const ticket = (
      await db.query
        .insertInto("support_tickets")
        .values({
          public_id: "tk-b",
          user_id: b,
          email: "ana.otra@gmail.com",
          category: "bug",
          subject: "No carga",
          created_at: daysAgo(2),
          updated_at: daysAgo(2),
          last_message_at: daysAgo(2),
          // Sin él, `resetD1` no puede borrar el usuario (SET NULL chocaría con el CHECK del ticket).
          access_token_hash: "hash-tk-b",
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
    await db.query
      .insertInto("support_messages")
      .values({ ticket_id: ticket, author_id: b, author_role: "user", body: "Ayuda", created_at: daysAgo(2) })
      .execute();
    await db.query
      .insertInto("user_bans")
      .values({ user_id: b, reason: "spam", banned_by: c, created_at: daysAgo(1) })
      .execute();

    const { merge } = await start(sessionA);
    const res = await call(sessionB, "/v1/me/merge/confirm", "POST", { merge });
    expect(res.status).toBe(204);

    // B ya no existe; A conserva su perfil, sube al rol mayor, hereda la verificación y la antigüedad.
    expect(await userRow(b)).toBeUndefined();
    expect(await userRow(a)).toMatchObject({
      email: anaBefore?.email,
      username: anaBefore?.username,
      display_name: anaBefore?.display_name,
      avatar_source_url: anaBefore?.avatar_source_url,
      bio: anaBefore?.bio ?? null,
      lang: anaBefore?.lang,
      theme: anaBefore?.theme,
      role: "moderator",
      email_verified: 1,
      created_at: bCreatedAt,
    });

    // Cuentas: el proveedor de B entra ahora como A.
    expect(
      (await all(db, "auth_accounts"))
        .filter((r) => r.user_id === a)
        .map((r) => r.provider_id)
        .sort(),
    ).toEqual(["discord", "google"]);

    // Reseñas: en alfa queda la más reciente (la de B, ahora de A); la de A se marcó eliminada.
    const reviews = await db.query
      .selectFrom("store_reviews")
      .select(["id", "user_id", "deleted_at"])
      .orderBy("id")
      .execute();
    expect(reviews.map((r) => [r.id, r.user_id, r.deleted_at !== null])).toEqual([
      [alfaA, a, true],
      [alfaB, a, false],
      [betaB, a, false],
      [betaC, c, false],
    ]);
    const stores = await db.query
      .selectFrom("stores")
      .select(["id", "rating_count", "rating_sum"])
      .orderBy("id")
      .execute();
    expect(stores).toEqual([
      { id: alfa, rating_count: 1, rating_sum: 1 },
      { id: beta, rating_count: 2, rating_sum: 7 },
    ]);

    // Votos, likes y reportes repetidos: queda uno (de A) y los contadores bajan.
    expect((await all(db, "store_review_votes")).map((v) => v.user_id)).toEqual([a]);
    expect(
      (await db.query.selectFrom("store_reviews").select("helpful_count").where("id", "=", betaC).executeTakeFirst())
        ?.helpful_count,
    ).toBe(1);
    expect((await all(db, "comment_likes")).map((l) => l.user_id)).toEqual([a]);
    expect(
      (await db.query.selectFrom("comments").select("like_count").where("id", "=", commentC).executeTakeFirst())
        ?.like_count,
    ).toBe(1);
    expect((await all(db, "reports")).map((r) => r.reporter_id)).toEqual([a]);
    expect(
      (await db.query.selectFrom("comments").select("author_id").where("id", "=", commentB).executeTakeFirst())
        ?.author_id,
    ).toBe(a);

    // Organizaciones: en la compartida A queda owner (el rol mayor); la de B pasa a A.
    const members = await db.query.selectFrom("organization_members").selectAll().orderBy("organization_id").execute();
    expect(members.map((m) => [m.organization_id, m.user_id, m.role, m.invited_by])).toEqual([
      [shared, a, "owner", null],
      [onlyB, a, "admin", c],
    ]);

    // Reclamo, cotización, ticket con su mensaje y la sanción: todo es de A (el ban viaja).
    expect((await all(db, "store_claims"))[0]?.claimant_id).toBe(a);
    expect((await all(db, "quotes"))[0]?.owner_id).toBe(a);
    expect((await all(db, "support_tickets"))[0]?.user_id).toBe(a);
    expect((await all(db, "support_messages"))[0]?.author_id).toBe(a);
    expect((await all(db, "user_bans"))[0]).toMatchObject({ user_id: a, banned_by: c });
    expect(MeSchema.parse(await (await call(sessionA, "/v1/me")).json()).ban).toMatchObject({ reason: "spam" });

    // La fila queda como registro, sin FK a B.
    const [row] = await all(db, "account_merges");
    expect(row).toMatchObject({
      survivor_id: a,
      status: "done",
      absorbed_id: b,
      absorbed_username: "beto",
      absorbed_email: "ana.otra@gmail.com",
    });
    expect(JSON.parse(row?.summary ?? "{}")).toEqual({
      counts: { reviews: 2, comments: 1, organizations: 2, claims: 1, quotes: 1, tickets: 1 },
      role: "moderator",
    });
  });

  test("revoca todas las sesiones de B, borra la cookie y el token no sirve dos veces", async () => {
    const { a, sessionA, sessionB } = await twoUsers();
    const b = (await all(db, "users")).find((u) => u.id !== a)?.id ?? "";
    const otherB = await sessionOf(b);
    const { merge } = await start(sessionA);

    const res = await call(sessionB, "/v1/me/merge/confirm", "POST", { merge });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie().find((c) => c.startsWith("framerate.merge="))).toContain("Max-Age=0");

    for (const session of [sessionB, otherB]) expect((await call(session, "/v1/me")).status).toBe(401);
    expect((await call(sessionA, "/v1/me")).status).toBe(200);
    expect((await all(db, "auth_sessions")).every((s) => s.user_id === a)).toBe(true);

    // Otro usuario con la misma cookie no puede reutilizarla.
    const c = await createUser(env, db, { name: "Carla", email: "carla@x.cl" });
    expect(await errorCode(await call(await sessionOf(c), "/v1/me/merge/confirm", "POST", { merge }))).toBe(
      "merge_not_found",
    );
  });

  test("si B era el único admin, A queda admin", async () => {
    const { a, b, sessionA, sessionB } = await twoUsers();
    await db.query.updateTable("users").set({ role: "admin" }).where("id", "=", b).execute();
    const { merge } = await start(sessionA);
    expect((await call(sessionB, "/v1/me/merge/confirm", "POST", { merge })).status).toBe(204);
    expect((await userRow(a))?.role).toBe("admin");
  });

  test("A con rol mayor no baja", async () => {
    const { a, sessionA, sessionB } = await twoUsers();
    await db.query.updateTable("users").set({ role: "admin" }).where("id", "=", a).execute();
    const { merge } = await start(sessionA);
    expect((await call(sessionB, "/v1/me/merge/confirm", "POST", { merge })).status).toBe(204);
    expect((await userRow(a))?.role).toBe("admin");
  });
});

test("toda FK a users(id) está cubierta por la fusión (USER_REFERENCES)", async () => {
  // D1 no autoriza `pragma_foreign_key_list(...)` como función; sí el PRAGMA suelto, tabla por tabla.
  const { results: tables } = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '%_fts%'",
    )
    .all<{ name: string }>();
  const found: string[] = [];
  for (const { name } of tables) {
    const { results } = await d1.prepare(`PRAGMA foreign_key_list("${name}")`).all<{ table: string; from: string }>();
    for (const fk of results) if (fk.table === "users") found.push(`${name}.${fk.from}`);
  }
  const covered = Object.entries(USER_REFERENCES).flatMap(([table, columns]) => columns.map((c) => `${table}.${c}`));
  expect(found.length).toBeGreaterThan(20);
  expect(covered.sort()).toEqual(found.sort());
});
