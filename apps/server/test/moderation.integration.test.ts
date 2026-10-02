import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema, ModerationActionPageSchema, ReportPageSchema, ReportSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, seedCatalog, sessionHeaders, testEnv } from "./helpers";

/** Reportes: crear, duplicado, tomar, resolver con bitácora y permisos; feedback de traducciones. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
let ana: string;
let beto: string;
let mod: string;
let mod2: string;
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
  mod2 = await createUser(env, db, { name: "Mod2", username: "mod2", role: "moderator" });
});

async function call(actor: string, path: string, method = "GET", body?: unknown) {
  const headers = new Headers({ "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" });
  if (actor !== "anon") for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
}
const code = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;
const report = (actor: string, targetType: string, targetId: string | number, reason = "spam") =>
  call(actor, "/v1/reports", "POST", { targetType, targetId: String(targetId), reason });

async function comment(author: string) {
  const res = await call(author, `/v1/products/${seed.asus}/comments`, "POST", { body: "comprar en sitio-malo.cl" });
  return ((await res.json()) as { id: number }).id;
}

describe("crear reportes", () => {
  test("201, 409 si ya hay uno vivo, 404 si no existe, 401 sin sesión", async () => {
    expect((await report("anon", "product", seed.asus)).status).toBe(401);
    expect((await report(ana, "product", seed.asus, "wrong_price")).status).toBe(201);
    const dup = await report(ana, "product", seed.asus, "spam");
    expect(dup.status).toBe(409);
    expect(await code(dup)).toBe("already_reported");
    expect((await report(beto, "product", seed.asus)).status).toBe(201);
    expect(await code(await report(ana, "product", 9999))).toBe("target_not_found");
    expect((await report(ana, "comment", "abc")).status).toBe(404);
    expect((await report(ana, "user", "beto")).status).toBe(201);
    expect((await report(ana, "store", seed.alfa)).status).toBe(201);

    const mine = await (await call(ana, "/v1/reports/my")).json();
    expect((mine as { items: unknown[] }).items).toHaveLength(3);
    expect(((await (await call(beto, "/v1/reports/my")).json()) as { items: unknown[] }).items).toHaveLength(1);
  });

  test("un usuario sancionado no puede reportar", async () => {
    await db.query
      .insertInto("user_bans")
      .values({ user_id: ana, reason: "x", banned_by: mod, expires_at: null, created_at: new Date().toISOString() })
      .execute();
    expect((await report(ana, "product", seed.asus)).status).toBe(403);
  });
});

describe("moderación", () => {
  test("un no-moderador recibe 403 y sin sesión 401", async () => {
    for (const path of ["/queue", "/reports", "/actions"]) {
      expect((await call(ana, `/v1/admin/moderation${path}`)).status).toBe(403);
      expect((await call("anon", `/v1/admin/moderation${path}`)).status).toBe(401);
    }
    expect(
      (await call(ana, "/v1/admin/moderation/reports/1/resolve", "POST", { resolution: "no_action" })).status,
    ).toBe(403);
  });

  test("tomar no pisa el de otra persona vigente", async () => {
    const { id } = (await (await report(ana, "product", seed.asus)).json()) as { id: number };
    const taken = ReportSchema.parse(
      await (await call(mod, `/v1/admin/moderation/reports/${id}/claim`, "POST")).json(),
    );
    expect(taken).toMatchObject({ status: "reviewing", claimedBy: { displayName: "Mod" } });
    expect((await call(mod, `/v1/admin/moderation/reports/${id}/claim`, "POST")).status).toBe(200);
    const other = await call(mod2, `/v1/admin/moderation/reports/${id}/claim`, "POST");
    expect(other.status).toBe(409);
    expect(await code(other)).toBe("claimed_by_other");
    expect(
      (await call(mod2, `/v1/admin/moderation/reports/${id}/resolve`, "POST", { resolution: "no_action" })).status,
    ).toBe(409);

    await d1.prepare("update reports set claimed_until = ? where id = ?").bind("2000-01-01T00:00:00.000Z", id).run();
    expect((await call(mod2, `/v1/admin/moderation/reports/${id}/claim`, "POST")).status).toBe(200);
    expect((await call(mod, "/v1/admin/moderation/reports/9999/claim", "POST")).status).toBe(404);
  });

  test("resolver con content_removed borra el comentario y registra la bitácora", async () => {
    const cid = await comment(beto);
    const { id } = (await (await report(ana, "comment", cid, "spam")).json()) as { id: number };
    const queue = ReportPageSchema.parse(await (await call(mod, "/v1/admin/moderation/queue")).json());
    expect(queue.items.map((r) => r.id)).toEqual([id]);

    const res = await call(mod, `/v1/admin/moderation/reports/${id}/resolve`, "POST", {
      resolution: "content_removed",
      note: "spam",
    });
    expect(res.status).toBe(200);
    expect(ReportSchema.parse(await res.json())).toMatchObject({
      status: "resolved",
      resolution: "content_removed",
      resolvedBy: { displayName: "Mod" },
    });
    const row = await db.query
      .selectFrom("comments")
      .select(["body", "deletion_reason"])
      .where("id", "=", cid)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ body: null, deletion_reason: "moderation" });

    const actions = ModerationActionPageSchema.parse(await (await call(mod, "/v1/admin/moderation/actions")).json());
    expect(actions.items.map((a) => [a.action, a.reportId]).sort()).toEqual([
      ["comment_removed", id],
      ["report_resolved", id],
    ]);
    expect(
      (await call(mod, `/v1/admin/moderation/reports/${id}/resolve`, "POST", { resolution: "no_action" })).status,
    ).toBe(409);
    expect(ReportPageSchema.parse(await (await call(mod, "/v1/admin/moderation/queue")).json()).total).toBe(0);
    const closed = ReportPageSchema.parse(
      await (await call(mod, "/v1/admin/moderation/reports?status=resolved")).json(),
    );
    expect(closed.total).toBe(1);
  });

  test("no_action descarta; user_banned sanciona al autor", async () => {
    const dismissed = (await (await report(ana, "product", seed.msi)).json()) as { id: number };
    await call(mod, `/v1/admin/moderation/reports/${dismissed.id}/resolve`, "POST", { resolution: "no_action" });
    const cid = await comment(beto);
    const banned = (await (await report(ana, "comment", cid, "harassment")).json()) as { id: number };
    expect(
      (await call(mod, `/v1/admin/moderation/reports/${banned.id}/resolve`, "POST", { resolution: "user_banned" }))
        .status,
    ).toBe(200);
    expect(await db.query.selectFrom("user_bans").select("user_id").where("user_id", "=", beto).execute()).toHaveLength(
      1,
    );

    const prod = (await (await report(ana, "product", seed.asus)).json()) as { id: number };
    const noTarget = await call(mod, `/v1/admin/moderation/reports/${prod.id}/resolve`, "POST", {
      resolution: "user_banned",
    });
    expect(noTarget.status).toBe(422);

    const actions = ModerationActionPageSchema.parse(await (await call(mod, "/v1/admin/moderation/actions")).json());
    expect(actions.items.map((a) => a.action).sort()).toEqual(["report_dismissed", "report_resolved", "user_banned"]);
  });
});

describe("translation feedback", () => {
  test("acepta anónimos y con sesión, valida el idioma", async () => {
    const body = { lang: "en", translationKey: "home.title", suggestedText: "Hello" };
    expect((await call("anon", "/v1/translation-feedback", "POST", body)).status).toBe(201);
    expect((await call(ana, "/v1/translation-feedback", "POST", { ...body, comment: "mejor así" })).status).toBe(201);
    expect((await call("anon", "/v1/translation-feedback", "POST", { ...body, lang: "fr" })).status).toBe(400);
    const rows = await db.query
      .selectFrom("translation_feedback")
      .select(["user_id", "status"])
      .orderBy("id")
      .execute();
    expect(rows).toEqual([
      { user_id: null, status: "new" },
      { user_id: ana, status: "new" },
    ]);
  });
});
