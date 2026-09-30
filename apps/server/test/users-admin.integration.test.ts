import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { AdminUserSchema, ApiErrorSchema, MeSchema, type Role } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { z } from "zod";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, sessionHeaders, testEnv, WEB_ORIGIN } from "./helpers";

/** Permisos del personal y administración de usuarios (sanciones, roles), contra D1 y Better Auth reales. */

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

async function call(actor: string | "token" | "anon", path: string, method = "GET", body?: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  if (actor === "token") headers.set("authorization", "Bearer test-admin-token");
  else if (actor !== "anon") {
    for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
    headers.set("origin", WEB_ORIGIN);
  }
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
}

const who = (name: string, role: Role = "user") =>
  createUser(env, db, { name, role, email: `${name.toLowerCase()}@example.com` });
const code = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;
const audit = () => all(db, "moderation_actions");
const banFuture = () => new Date(Date.now() + 7 * 86_400_000).toISOString();

describe("acceso del personal", () => {
  test("anónimo → 401; usuario común → 403; moderador y token → 200", async () => {
    const user = await who("Ana");
    const mod = await who("Mod", "moderator");
    expect((await call("anon", "/v1/admin/users?q=an")).status).toBe(401);
    const forbidden = await call(user, "/v1/admin/users?q=an");
    expect(forbidden.status).toBe(403);
    expect(await code(forbidden)).toBe("forbidden");
    expect((await call(mod, "/v1/admin/users?q=an")).status).toBe(200);
    expect((await call("token", "/v1/admin/users?q=an")).status).toBe(200);
  });

  test("un token inválido es 401 aunque haya sesión; no cae a la cookie", async () => {
    const admin = await who("Root", "admin");
    const headers = await sessionHeaders(env, admin);
    headers.set("authorization", "Bearer token-equivocado");
    const res = await app.request("/v1/admin/users?q=ro", { headers }, env);
    expect(res.status).toBe(401);
  });

  test("las demás rutas de admin también exigen el rol (revisión de matches y crawls)", async () => {
    const user = await who("Ana");
    const mod = await who("Mod", "moderator");
    for (const path of ["/v1/admin/reviews", "/v1/admin/crawls", "/v1/admin/quarantine"]) {
      expect((await call("anon", path)).status).toBe(401);
      expect((await call(user, path)).status).toBe(403);
      expect((await call(mod, path)).status).toBe(200);
    }
  });

  test("una escritura de personal desde otro origen → 403 (CSRF)", async () => {
    const mod = await who("Mod", "moderator");
    const target = await who("Ana");
    const headers = await sessionHeaders(env, mod);
    headers.set("origin", "https://evil.example");
    headers.set("content-type", "application/json");
    const res = await app.request(`/v1/admin/users/${target}/ban`, { method: "POST", headers, body: "{}" }, env);
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("bad_origin");
    expect(await all(db, "user_bans")).toEqual([]);
  });
});

describe("búsqueda de usuarios", () => {
  test("busca por fragmento de handle o nombre; el correo sólo coincide exacto", async () => {
    const mod = await who("Mod", "moderator");
    await who("Ana");
    await createUser(env, db, { name: "Anabel Ruiz", email: "anabel@example.com" });

    const byFragment = z
      .object({ items: z.array(AdminUserSchema) })
      .parse(await (await call(mod, "/v1/admin/users?q=ana")).json());
    expect(byFragment.items.map((u) => u.username)).toEqual(["ana", "anabel"]);
    expect(byFragment.items.every((u) => u.ban === null)).toBe(true);

    const byEmailFragment = await (await call(mod, "/v1/admin/users?q=anabel@exa")).json();
    expect((byEmailFragment as { items: unknown[] }).items).toEqual([]);
    const byEmailExact = (await (await call(mod, "/v1/admin/users?q=anabel@example.com")).json()) as {
      items: { username: string }[];
    };
    expect(byEmailExact.items.map((u) => u.username)).toEqual(["anabel"]);
  });

  test("los comodines del admin son texto literal, y menos de 2 caracteres es error", async () => {
    const mod = await who("Mod", "moderator");
    await who("Ana");
    const wildcard = (await (await call(mod, "/v1/admin/users?q=%25%25")).json()) as { items: unknown[] };
    expect(wildcard.items).toEqual([]);
    const short = await call(mod, "/v1/admin/users?q=a");
    expect(short.status).toBe(400);
    expect(await code(short)).toBe("invalid_request");
  });

  test("muestra la sanción vigente de cada usuario", async () => {
    const mod = await who("Mod", "moderator");
    const ana = await who("Ana");
    await call(mod, `/v1/admin/users/${ana}/ban`, "POST", { reason: "spam" });
    const list = z
      .object({ items: z.array(AdminUserSchema) })
      .parse(await (await call(mod, "/v1/admin/users?q=ana")).json());
    expect(list.items[0]?.ban).toEqual({ reason: "spam", expiresAt: null });
  });
});

describe("sanciones", () => {
  test("un moderador suspende a un usuario: queda en su perfil y en la bitácora", async () => {
    const mod = await who("Mod", "moderator");
    const ana = await who("Ana");
    const until = banFuture();
    const res = await call(mod, `/v1/admin/users/${ana}/ban`, "POST", { reason: "spam repetido", expiresAt: until });
    expect(res.status).toBe(204);

    const me = MeSchema.parse(await (await call(ana, "/v1/me")).json());
    expect(me.ban).toEqual({ reason: "spam repetido", expiresAt: until });

    const [entry] = await audit();
    expect(entry).toMatchObject({
      actor_id: mod,
      action: "user_banned",
      target_type: "user",
      target_id: ana,
      reason: "spam repetido",
    });
    expect(JSON.parse(entry?.after ?? "null")).toEqual({ expiresAt: until });
  });

  test("con el token de servicio el actor de la bitácora es null y no se puede sancionar a un admin", async () => {
    const ana = await who("Ana");
    const root = await who("Root", "admin");
    expect((await call("token", `/v1/admin/users/${ana}/ban`, "POST", {})).status).toBe(204);
    expect((await audit())[0]?.actor_id).toBeNull();
    expect((await call("token", `/v1/admin/users/${root}/ban`, "POST", {})).status).toBe(403);
  });

  test("no se puede sancionar a alguien de igual o mayor nivel, ni a uno mismo", async () => {
    const mod = await who("Mod", "moderator");
    const otherMod = await who("Mod2", "moderator");
    const admin = await who("Root", "admin");

    for (const target of [otherMod, admin]) {
      const res = await call(mod, `/v1/admin/users/${target}/ban`, "POST", {});
      expect(res.status).toBe(403);
      expect(await code(res)).toBe("insufficient_role");
    }
    const self = await call(mod, `/v1/admin/users/${mod}/ban`, "POST", {});
    expect(self.status).toBe(400);
    expect(await code(self)).toBe("cannot_target_self");

    // Un admin sí puede sancionar a un moderador.
    expect((await call(admin, `/v1/admin/users/${mod}/ban`, "POST", {})).status).toBe(204);
  });

  test("valida la fecha de término, el duplicado y el usuario inexistente", async () => {
    const mod = await who("Mod", "moderator");
    const ana = await who("Ana");

    const past = await call(mod, `/v1/admin/users/${ana}/ban`, "POST", { expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(past.status).toBe(400);
    expect(await code(past)).toBe("invalid_expiry");

    expect((await call(mod, `/v1/admin/users/${ana}/ban`, "POST", {})).status).toBe(204);
    const again = await call(mod, `/v1/admin/users/${ana}/ban`, "POST", {});
    expect(again.status).toBe(409);
    expect(await code(again)).toBe("already_banned");

    const missing = await call(mod, "/v1/admin/users/no-existe/ban", "POST", {});
    expect(missing.status).toBe(404);
    expect(await code(missing)).toBe("user_not_found");
  });

  test("levantar una sanción conserva el historial y permite volver a suspender", async () => {
    const mod = await who("Mod", "moderator");
    const ana = await who("Ana");
    await call(mod, `/v1/admin/users/${ana}/ban`, "POST", { reason: "primera" });

    expect((await call(mod, `/v1/admin/users/${ana}/unban`, "POST")).status).toBe(204);
    expect(MeSchema.parse(await (await call(ana, "/v1/me")).json()).ban).toBeNull();

    const notBanned = await call(mod, `/v1/admin/users/${ana}/unban`, "POST");
    expect(notBanned.status).toBe(409);
    expect(await code(notBanned)).toBe("not_banned");

    expect((await call(mod, `/v1/admin/users/${ana}/ban`, "POST", { reason: "segunda" })).status).toBe(204);
    const bans = await all(db, "user_bans");
    expect(bans.map((b) => [b.reason, b.lifted_at !== null, b.lifted_by])).toEqual([
      ["primera", true, mod],
      ["segunda", false, null],
    ]);
    expect((await audit()).map((a) => a.action)).toEqual(["user_banned", "user_unbanned", "user_banned"]);
  });
});

describe("roles", () => {
  test("sólo un admin cambia roles, y queda en la bitácora con el antes y el después", async () => {
    const mod = await who("Mod", "moderator");
    const admin = await who("Root", "admin");
    const ana = await who("Ana");

    const denied = await call(mod, `/v1/admin/users/${ana}/role`, "PATCH", { role: "moderator" });
    expect(denied.status).toBe(403);
    expect(await code(denied)).toBe("forbidden");

    expect((await call(admin, `/v1/admin/users/${ana}/role`, "PATCH", { role: "moderator" })).status).toBe(204);
    expect(MeSchema.parse(await (await call(ana, "/v1/me")).json()).role).toBe("moderator");
    const [entry] = await audit();
    expect(entry).toMatchObject({ actor_id: admin, action: "role_changed", target_id: ana });
    expect(JSON.parse(entry?.before ?? "null")).toEqual({ role: "user" });
    expect(JSON.parse(entry?.after ?? "null")).toEqual({ role: "moderator" });
  });

  test("el cambio de rol aplica al instante, sin esperar a que venza la sesión", async () => {
    const admin = await who("Root", "admin");
    const ana = await who("Ana");
    const headers = await sessionHeaders(env, ana);
    headers.set("origin", WEB_ORIGIN);
    const get = () => app.request("/v1/admin/users?q=ana", { headers }, env);

    expect((await get()).status).toBe(403);
    await call(admin, `/v1/admin/users/${ana}/role`, "PATCH", { role: "moderator" });
    expect((await get()).status).toBe(200);
    await call(admin, `/v1/admin/users/${ana}/role`, "PATCH", { role: "user" });
    expect((await get()).status).toBe(403);
  });

  test("no puedes cambiar tu propio rol, ni dejar al sistema sin administradores", async () => {
    const admin = await who("Root", "admin");
    const self = await call(admin, `/v1/admin/users/${admin}/role`, "PATCH", { role: "user" });
    expect(self.status).toBe(400);
    expect(await code(self)).toBe("cannot_target_self");

    // El token de servicio no es un usuario: puede intentar degradar al único admin, y la regla lo frena.
    const last = await call("token", `/v1/admin/users/${admin}/role`, "PATCH", { role: "user" });
    expect(last.status).toBe(409);
    expect(await code(last)).toBe("last_admin");

    const second = await who("Root2", "admin");
    expect((await call("token", `/v1/admin/users/${second}/role`, "PATCH", { role: "user" })).status).toBe(204);
  });

  test("rechaza roles que no existen y no registra cambios que no cambian nada", async () => {
    const admin = await who("Root", "admin");
    const ana = await who("Ana");
    expect((await call(admin, `/v1/admin/users/${ana}/role`, "PATCH", { role: "superadmin" })).status).toBe(400);
    expect((await call(admin, `/v1/admin/users/${ana}/role`, "PATCH", { role: "user" })).status).toBe(204);
    expect(await audit()).toEqual([]);
  });
});
