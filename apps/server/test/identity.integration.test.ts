import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema, AuthProvidersSchema, MeSchema, PublicProfileSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { getMigrations } from "better-auth/db/migration";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createAuth } from "@/features/identity/auth";
import { assertNotBanned } from "@/features/identity/policies";
import { createUser, daysAgo, sessionHeaders, testEnv, WEB_ORIGIN } from "./helpers";

/**
 * Identidad de punta a punta contra D1 real y Better Auth real: el login OAuth
 * se simula creando el usuario por el mismo camino interno que usa el callback.
 */

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

const request = (path: string, init: RequestInit = {}, e: Env = env) => app.request(path, init, e);

/** Petición autenticada como `userId` (sesión válida, con el Origin de la web como haría el navegador). */
async function asUser(userId: string, path: string, init: RequestInit = {}) {
  const headers = await sessionHeaders(env, userId);
  headers.set("origin", WEB_ORIGIN);
  headers.set("content-type", "application/json");
  for (const [k, v] of Object.entries((init.headers as Record<string, string>) ?? {})) headers.set(k, v);
  return request(path, { ...init, headers });
}

const json = <T>(res: Response) => res.json() as Promise<T>;
const userRow = (id: string) => db.query.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

describe("configuración de Better Auth", () => {
  test("todas las tablas y columnas que Better Auth necesita existen en nuestras migraciones", async () => {
    const auth = createAuth(env);
    // Better Auth espera columnas `date`; en SQLite las guardamos como TEXT ISO-8601 (equivalente), así que se silencia su aviso de tipo.
    const { toBeCreated, toBeAdded } = await getMigrations({ ...auth.options, logger: { disabled: true } });
    expect(toBeCreated).toEqual([]);
    expect(toBeAdded).toEqual([]);
  });

  test("GET /v1/auth/providers lista sólo los proveedores con credenciales", async () => {
    const list = AuthProvidersSchema.parse(await json(await request("/v1/auth/providers")));
    expect(list.items).toEqual([{ id: "discord", label: "Discord" }]);

    const none = testEnv(d1, {}, { DISCORD_CLIENT_ID: undefined, DISCORD_CLIENT_SECRET: undefined }).env;
    expect(AuthProvidersSchema.parse(await json(await request("/v1/auth/providers", {}, none))).items).toEqual([]);

    const all3 = testEnv(
      d1,
      {},
      {
        GOOGLE_CLIENT_ID: "g",
        GOOGLE_CLIENT_SECRET: "g",
        FACEBOOK_CLIENT_ID: "f",
        FACEBOOK_CLIENT_SECRET: "f",
      },
    ).env;
    const ids = AuthProvidersSchema.parse(await json(await request("/v1/auth/providers", {}, all3))).items.map(
      (p) => p.id,
    );
    expect(ids).toEqual(["discord", "google", "facebook"]);
  });

  test("cada proveedor habilitado arma su URL de autorización (configuración válida, sin red)", async () => {
    const withAll = testEnv(
      d1,
      {},
      {
        GOOGLE_CLIENT_ID: "g",
        GOOGLE_CLIENT_SECRET: "g",
        FACEBOOK_CLIENT_ID: "f",
        FACEBOOK_CLIENT_SECRET: "f",
      },
    ).env;
    const hosts: Record<string, string> = {
      discord: "discord.com",
      google: "accounts.google.com",
      facebook: "facebook.com",
    };
    for (const [provider, host] of Object.entries(hosts)) {
      const res = await request(
        "/v1/auth/sign-in/social",
        {
          method: "POST",
          headers: { "content-type": "application/json", origin: WEB_ORIGIN },
          body: JSON.stringify({ provider, callbackURL: `${WEB_ORIGIN}/` }),
        },
        withAll,
      );
      expect(res.status).toBe(200);
      const body = await json<{ url: string; redirect: boolean }>(res);
      expect(body.redirect).toBe(true);
      expect(new URL(body.url).host).toContain(host);
      // El callback apunta a ESTA API, con el id del proveedor en la ruta.
      expect(new URL(body.url).searchParams.get("redirect_uri")).toBe(
        `http://localhost:8787/v1/auth/callback/${provider}`,
      );
      // Better Auth suma `scope` a sus scopes por defecto: repetirlos en `providers.ts` los duplica en la URL.
      const scopes = new URL(body.url).searchParams.get("scope")?.split(/[\s,]+/) ?? [];
      expect(new Set(scopes).size).toBe(scopes.length);
      if (provider === "discord") expect(scopes).toEqual(["identify", "email"]);
    }
    // El estado OAuth se guardó en nuestra tabla (prueba el mapeo de columnas de verificaciones).
    expect((await all(db, "auth_verifications")).length).toBeGreaterThanOrEqual(3);
  });

  test("iniciar sesión con un proveedor que no está habilitado falla", async () => {
    const res = await request("/v1/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: WEB_ORIGIN },
      body: JSON.stringify({ provider: "facebook", callbackURL: `${WEB_ORIGIN}/` }),
    });
    expect(res.ok).toBe(false);
  });

  test("las rutas de Better Auth que dejarían al cliente escribir su perfil están deshabilitadas", async () => {
    const userId = await createUser(env, db, { name: "Ana" });
    const headers = await sessionHeaders(env, userId);
    headers.set("origin", WEB_ORIGIN);
    headers.set("content-type", "application/json");
    const res = await request("/v1/auth/update-user", {
      method: "POST",
      headers,
      body: JSON.stringify({ image: "https://evil.example/pixel.png", name: "Hackeado" }),
    });
    expect(res.status).toBe(404);
    const row = await userRow(userId);
    expect(row.display_name).toBe("Ana");
    expect(row.avatar_source_url).toBeNull();
  });
});

describe("creación de usuarios (login OAuth)", () => {
  test("genera un username seguro, rol user y valores por defecto", async () => {
    const id = await createUser(env, db, {
      name: "  María   José ",
      email: "Maria.Jose@Example.com",
      username: "Maria.Jose",
      image: "https://cdn.discordapp.com/avatars/1/a.png",
    });
    const row = await userRow(id);
    expect(row).toMatchObject({
      username: "maria_jose",
      display_name: "María José",
      email: "maria.jose@example.com",
      role: "user",
      lang: "es",
      theme: "system",
      avatar_source_url: "https://cdn.discordapp.com/avatars/1/a.png",
      avatar_key: null,
      deleted_at: null,
    });
    const [account] = await all(db, "auth_accounts");
    expect(account).toMatchObject({ user_id: id, provider_id: "discord" });
  });

  test("dos usuarios con el mismo handle reciben handles distintos", async () => {
    const a = await userRow(await createUser(env, db, { name: "Ana", username: "ana" }));
    const b = await userRow(await createUser(env, db, { name: "Otra Ana", username: "ana", email: "otra@x.cl" }));
    expect(a.username).toBe("ana");
    expect(b.username).toMatch(/^ana_\d{4}$/);
  });

  test("un handle reservado nunca se asigna tal cual", async () => {
    const row = await userRow(await createUser(env, db, { name: "Admin", username: "admin" }));
    expect(row.username).not.toBe("admin");
    expect(row.username).toMatch(/^admin_\d{4}$/);
  });

  test("sin handle del proveedor, lo deriva del correo o del nombre", async () => {
    const row = await userRow(await createUser(env, db, { name: "Sofía Ñandú", email: "sofi.n@example.com" }));
    expect(row.username).toBe("sofi_n");
  });

  test("el rol no se puede fijar desde el proveedor ni el cliente", async () => {
    const auth = createAuth(env);
    const ctx = await auth.$context;
    const { user } = await ctx.internalAdapter.createOAuthUser(
      { email: "x@x.cl", name: "Intruso", emailVerified: true, role: "admin" } as never,
      { providerId: "discord", accountId: "1" } as never,
    );
    expect((await userRow(user.id)).role).toBe("user");
  });
});

describe("GET /v1/me", () => {
  test("sin sesión → 401", async () => {
    const res = await request("/v1/me");
    expect(res.status).toBe(401);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("unauthorized");
  });

  test("con sesión devuelve el perfil propio", async () => {
    const id = await createUser(env, db, { name: "Ana", image: "https://cdn.discordapp.com/a.png" });
    const res = await asUser(id, "/v1/me");
    expect(res.status).toBe(200);
    const me = MeSchema.parse(await res.json());
    expect(me).toMatchObject({
      id,
      username: "ana",
      displayName: "Ana",
      email: "ana@example.com",
      avatarUrl: "https://cdn.discordapp.com/a.png",
      role: "user",
      ban: null,
    });
  });

  test("una cuenta eliminada deja de autenticar aunque tenga cookie, y no puede abrir sesiones nuevas", async () => {
    const id = await createUser(env, db, { name: "Ana" });
    const headers = await sessionHeaders(env, id);
    headers.set("origin", WEB_ORIGIN);
    expect((await request("/v1/me", { headers })).status).toBe(200);

    await db.query
      .updateTable("users")
      .set({ deleted_at: daysAgo(0) })
      .where("id", "=", id)
      .execute();
    expect((await request("/v1/me", { headers })).status).toBe(401);
    await expect(sessionHeaders(env, id)).rejects.toThrow();
  });

  test("una URL de avatar que no es https no se expone", async () => {
    const id = await createUser(env, db, { name: "Ana" });
    await db.query
      .updateTable("users")
      .set({ avatar_source_url: "http://insecure.example/a.png" })
      .where("id", "=", id)
      .execute();
    expect(MeSchema.parse(await json(await asUser(id, "/v1/me"))).avatarUrl).toBeNull();
  });
});

describe("PATCH /v1/me", () => {
  const patch = (id: string, body: unknown, headers: Record<string, string> = {}) =>
    asUser(id, "/v1/me", { method: "PATCH", body: JSON.stringify(body), headers });

  test("actualiza nombre, handle, biografía e idioma", async () => {
    const id = await createUser(env, db, { name: "Ana" });
    const res = await patch(id, {
      displayName: "Ana Pérez",
      username: "ana_perez",
      bio: "Armo PCs",
      lang: "en",
      theme: "dark",
    });
    expect(res.status).toBe(200);
    expect(MeSchema.parse(await res.json())).toMatchObject({
      displayName: "Ana Pérez",
      username: "ana_perez",
      bio: "Armo PCs",
      lang: "en",
      theme: "dark",
    });
    expect(await userRow(id)).toMatchObject({ username: "ana_perez", lang: "en", theme: "dark" });
  });

  test("una biografía vacía la borra", async () => {
    const id = await createUser(env, db, { name: "Ana" });
    await patch(id, { bio: "hola" });
    const me = MeSchema.parse(await json(await patch(id, { bio: "   " })));
    expect(me.bio).toBeNull();
  });

  test("el handle ya tomado o reservado devuelve 409", async () => {
    const ana = await createUser(env, db, { name: "Ana" });
    await createUser(env, db, { name: "Beto", email: "beto@x.cl" });

    const taken = await patch(ana, { username: "beto" });
    expect(taken.status).toBe(409);
    expect(ApiErrorSchema.parse(await taken.json()).error.code).toBe("username_taken");

    const reserved = await patch(ana, { username: "soporte" });
    expect(reserved.status).toBe(409);
    expect(ApiErrorSchema.parse(await reserved.json()).error.code).toBe("username_reserved");

    // Quedarse con su propio handle no es un conflicto.
    expect((await patch(ana, { username: "ana" })).status).toBe(200);
  });

  test("valida el formato: nada inválido llega a la base", async () => {
    const id = await createUser(env, db, { name: "Ana" });
    for (const body of [
      { username: "Ana Perez" },
      { username: "ab" },
      { displayName: "" },
      { bio: "x".repeat(281) },
      { lang: "fr" },
      {},
    ]) {
      const res = await patch(id, body);
      expect(res.status).toBe(400);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("invalid_request");
    }
    expect((await userRow(id)).username).toBe("ana");
  });

  test("rol, correo y avatar no se pueden cambiar por aquí", async () => {
    const id = await createUser(env, db, { name: "Ana" });
    for (const body of [{ role: "admin" }, { email: "otro@x.cl" }, { avatarUrl: "https://evil.example/a.png" }]) {
      expect((await patch(id, body)).status).toBe(400);
    }
    expect(await userRow(id)).toMatchObject({ role: "user", email: "ana@example.com", avatar_source_url: null });
  });

  test("desde un origen que no es la web → 403 (CSRF)", async () => {
    const id = await createUser(env, db, { name: "Ana" });
    const res = await patch(id, { displayName: "Hackeada" }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("bad_origin");
    expect((await userRow(id)).display_name).toBe("Ana");
  });
});

describe("perfil público y CORS", () => {
  test("GET /v1/users/:username no expone correo, rol ni sanciones", async () => {
    const id = await createUser(env, db, { name: "Ana", image: "https://cdn.discordapp.com/a.png" });
    const res = await request("/v1/users/ana");
    expect(res.status).toBe(200);
    const body = await json<Record<string, unknown>>(res);
    expect(PublicProfileSchema.parse(body)).toMatchObject({ username: "ana", displayName: "Ana" });
    expect(Object.keys(body).sort()).toEqual(["avatarUrl", "bio", "createdAt", "displayName", "username"]);
    expect(JSON.stringify(body)).not.toContain(id);
  });

  test("usuario inexistente o eliminado → 404", async () => {
    expect((await request("/v1/users/nadie")).status).toBe(404);
    const id = await createUser(env, db, { name: "Ana" });
    await db.query
      .updateTable("users")
      .set({ deleted_at: daysAgo(0) })
      .where("id", "=", id)
      .execute();
    expect((await request("/v1/users/ana")).status).toBe(404);
  });

  test("CORS con cookies sólo para la web", async () => {
    const ok = await request("/v1/me", {
      method: "OPTIONS",
      headers: { origin: WEB_ORIGIN, "access-control-request-method": "PATCH" },
    });
    expect(ok.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");

    const other = await request("/v1/me", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "PATCH" },
    });
    expect(other.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
  });
});

describe("sanciones", () => {
  async function ban(userId: string, extra: { expires?: string; lifted?: string } = {}) {
    await db.query
      .insertInto("user_bans")
      .values({
        user_id: userId,
        reason: "spam",
        created_at: daysAgo(3),
        expires_at: extra.expires ?? null,
        lifted_at: extra.lifted ?? null,
      })
      .execute();
  }
  const future = () => new Date(Date.now() + 5 * 86_400_000).toISOString();

  test("un usuario suspendido puede iniciar sesión y editar su perfil, pero no publicar", async () => {
    const id = await createUser(env, db, { name: "Ana" });
    await ban(id);
    const me = MeSchema.parse(await json(await asUser(id, "/v1/me")));
    expect(me.ban).toEqual({ reason: "spam", expiresAt: null });
    expect((await asUser(id, "/v1/me", { method: "PATCH", body: JSON.stringify({ bio: "sigo aquí" }) })).status).toBe(
      200,
    );
    const sessionUser = {
      id: me.id,
      email: me.email,
      username: me.username,
      displayName: me.displayName,
      role: me.role,
      ban: me.ban,
    };
    expect(() => assertNotBanned(sessionUser)).toThrow("suspendida");
  });

  test("una sanción temporal vigente aplica; vencida o levantada no", async () => {
    const active = await createUser(env, db, { name: "Activa" });
    const expired = await createUser(env, db, { name: "Vencida", email: "v@x.cl" });
    const lifted = await createUser(env, db, { name: "Levantada", email: "l@x.cl" });
    await ban(active, { expires: future() });
    await ban(expired, { expires: daysAgo(1) });
    await ban(lifted, { lifted: daysAgo(1) });

    const banOf = async (id: string) => MeSchema.parse(await json(await asUser(id, "/v1/me"))).ban;
    expect((await banOf(active))?.expiresAt).not.toBeNull();
    expect(await banOf(expired)).toBeNull();
    expect(await banOf(lifted)).toBeNull();
  });

  test("assertNotBanned deja pasar a quien no está suspendido", () => {
    const user = { id: "1", email: "a@b.cl", username: "ana", displayName: "Ana", role: "user" as const, ban: null };
    expect(() => assertNotBanned(user)).not.toThrow();
  });
});

describe("CORS de la API", () => {
  test("la lectura pública y el panel de admin también aceptan cookies desde la web (y sólo desde ella)", async () => {
    for (const path of ["/v1/products", "/v1/categories", "/v1/admin/users"]) {
      const ok = await request(path, {
        method: "OPTIONS",
        headers: { origin: WEB_ORIGIN, "access-control-request-method": "GET" },
      });
      expect(ok.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
      expect(ok.headers.get("access-control-allow-credentials")).toBe("true");

      const other = await request(path, {
        method: "OPTIONS",
        headers: { origin: "https://evil.example", "access-control-request-method": "GET" },
      });
      expect(other.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
      expect(other.headers.get("access-control-allow-origin")).not.toBe("*");
    }
  });
});
