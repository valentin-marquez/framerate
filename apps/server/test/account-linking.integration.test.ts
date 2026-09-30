import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { LinkedAccountsSchema, MeSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { daysAgo, testEnv, WEB_ORIGIN } from "./helpers";

/**
 * Cuentas vinculadas de punta a punta: D1 real, Better Auth real y el callback OAuth completo
 * (state + cookie). Sólo se falsea la red del proveedor: el canje del código y el perfil.
 */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();

interface Profile {
  id: string;
  email: string;
  verified: boolean;
  name: string;
  image?: string;
}

const profiles = new Map<string, Profile>();
const realFetch = globalThis.fetch;

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Discord entrega el perfil en `/users/@me`; Google, en el `id_token` del canje (Better Auth lo decodifica sin verificar la firma: viene del endpoint de tokens por TLS). */
async function fakeProviders(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input instanceof Request ? input.url : input);
  const code = () => new URLSearchParams(String(init?.body)).get("code") ?? "";
  const profileOf = (key: string) => {
    const profile = profiles.get(key);
    if (!profile) throw new Error(`código desconocido: ${key}`);
    return profile;
  };

  if (url === "https://discord.com/api/oauth2/token") {
    return Response.json({ access_token: code(), token_type: "Bearer", expires_in: 3600, scope: "identify email" });
  }
  if (url === "https://discord.com/api/users/%40me") {
    const p = profileOf(new Headers(init?.headers).get("authorization")?.replace("Bearer ", "") ?? "");
    return Response.json({
      id: p.id,
      username: p.name.toLowerCase(),
      global_name: p.name,
      email: p.email,
      verified: p.verified,
      avatar: "abc123",
      discriminator: "0",
    });
  }
  if (url === "https://oauth2.googleapis.com/token") {
    const p = profileOf(code());
    const claims = {
      iss: "https://accounts.google.com",
      aud: env.GOOGLE_CLIENT_ID,
      sub: p.id,
      email: p.email,
      email_verified: p.verified,
      name: p.name,
      picture: p.image,
    };
    return Response.json({
      access_token: `google-${code()}`,
      id_token: `${base64url({ alg: "none" })}.${base64url(claims)}.x`,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid email profile",
    });
  }
  return realFetch(input, init);
}

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1, {}, { GOOGLE_CLIENT_ID: "google-test-id", GOOGLE_CLIENT_SECRET: "google-test-secret" }));
  globalThis.fetch = fakeProviders as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  return dispose();
});
beforeEach(() => resetD1(d1));

const request = (path: string, init: RequestInit = {}) => app.request(path, init, env);

/** Cookies vigentes de una respuesta (`nombre=valor`), sin las que se borran. */
const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0] ?? "")
    .filter((c) => !c.endsWith("="));

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  request(path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB_ORIGIN, ...headers },
    body: JSON.stringify(body),
  });

/**
 * Recorre el OAuth completo: sin `session` es un login (`sign-in/social`); con `session` vincula al usuario
 * de esa sesión (`link-social`). Devuelve adónde redirige el callback y la sesión que dejó, si dejó una.
 */
async function oauth(provider: "discord" | "google", profile: Profile, session?: string) {
  const start = await post(
    session ? "/v1/auth/link-social" : "/v1/auth/sign-in/social",
    { provider, callbackURL: `${WEB_ORIGIN}/listo`, errorCallbackURL: `${WEB_ORIGIN}/error` },
    session ? { cookie: session } : {},
  );
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const code = crypto.randomUUID();
  profiles.set(code, profile);

  const cookie = [session, ...cookiesOf(start)].filter(Boolean).join("; ");
  const state = new URL(url).searchParams.get("state");
  const res = await request(`/v1/auth/callback/${provider}?code=${code}&state=${state}`, { headers: { cookie } });
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get("location") ?? "");
  const sessionCookie = cookiesOf(res).find((c) => c.startsWith("framerate.session_token="));
  return { location, error: location.searchParams.get("error"), session: sessionCookie };
}

/** Login que debe resultar en sesión. */
async function signIn(provider: "discord" | "google", profile: Profile) {
  const result = await oauth(provider, profile);
  expect(result.error).toBeNull();
  if (!result.session) throw new Error("el login no dejó sesión");
  return result.session;
}

const me = async (session: string) =>
  MeSchema.parse(await (await request("/v1/me", { headers: { cookie: session } })).json());
const accounts = async () =>
  (await all(db, "auth_accounts")).map((a) => ({ user: a.user_id, provider: a.provider_id, id: a.account_id }));
const listAccounts = async (session: string) => {
  const res = await request("/v1/auth/list-accounts", { headers: { cookie: session } });
  expect(res.status).toBe(200);
  return res.json() as Promise<Record<string, unknown>[]>;
};

const ana: Profile = {
  id: "1001",
  email: "ana@gmail.com",
  verified: true,
  name: "Ana",
};
const anaGoogle: Profile = {
  id: "g-ana",
  email: "ana@gmail.com",
  verified: true,
  name: "Ana en Google",
  image: "https://lh3.googleusercontent.com/ana.png",
};

describe("vinculación implícita (mismo correo)", () => {
  test("Discord y luego Google con el mismo correo verificado → un solo usuario con dos cuentas", async () => {
    const discord = await signIn("discord", ana);
    const before = await me(discord);

    const google = await oauth("google", anaGoogle);
    expect(google.location.href).toBe(`${WEB_ORIGIN}/listo`);
    expect((await me(google.session ?? "")).id).toBe(before.id);

    expect(await all(db, "users")).toHaveLength(1);
    expect(await accounts()).toEqual([
      { user: before.id, provider: "discord", id: "1001" },
      { user: before.id, provider: "google", id: "g-ana" },
    ]);
    // Vincular no copia el perfil del proveedor nuevo.
    expect(await me(discord)).toEqual(before);
  });

  test("Google con ese correo sin verificar no vincula ni crea usuario", async () => {
    await signIn("discord", ana);
    const google = await oauth("google", { ...anaGoogle, verified: false });
    expect(google.location.origin + google.location.pathname).toBe(`${WEB_ORIGIN}/error`);
    expect(google.error).toBe("account_not_linked");
    expect(google.session).toBeUndefined();
    expect(await all(db, "users")).toHaveLength(1);
    expect((await accounts()).map((a) => a.provider)).toEqual(["discord"]);
  });

  test("si el correo del usuario existente no está verificado, tampoco vincula", async () => {
    await signIn("discord", { ...ana, verified: false });
    expect((await all(db, "users"))[0]?.email_verified).toBe(0);
    expect((await oauth("google", anaGoogle)).error).toBe("account_not_linked");
    expect((await accounts()).map((a) => a.provider)).toEqual(["discord"]);
  });
});

describe("vinculación manual (link-social con sesión)", () => {
  const work: Profile = {
    id: "g-trabajo",
    email: "ana.trabajo@gmail.com",
    verified: true,
    name: "Otra Persona",
    image: "https://lh3.googleusercontent.com/otra.png",
  };

  test("conecta un Google con otro correo al usuario actual sin cambiar su perfil", async () => {
    const session = await signIn("discord", ana);
    const before = await db.query.selectFrom("users").selectAll().executeTakeFirstOrThrow();

    const link = await oauth("google", work, session);
    expect(link.location.href).toBe(`${WEB_ORIGIN}/listo`);
    expect(await all(db, "users")).toEqual([before]);
    expect(await accounts()).toEqual([
      { user: before.id, provider: "discord", id: "1001" },
      { user: before.id, provider: "google", id: "g-trabajo" },
    ]);

    // Desde ahora ese Google entra como la misma persona.
    expect((await me(await signIn("google", work))).id).toBe(before.id);
  });

  test("no vincula una cuenta cuyo correo el proveedor no verificó", async () => {
    const session = await signIn("discord", ana);
    expect((await oauth("google", { ...work, verified: false }, session)).error).toBe("unable_to_link_account");
    expect((await accounts()).map((a) => a.provider)).toEqual(["discord"]);
  });

  test("una cuenta que ya es de otro usuario → account_already_linked_to_different_user y nada cambia", async () => {
    await signIn("google", { ...work, email: "beto@gmail.com", name: "Beto" });
    const session = await signIn("discord", ana);
    const before = await accounts();

    const link = await oauth("google", { ...work, email: "beto@gmail.com" }, session);
    expect(link.error).toBe("account_already_linked_to_different_user");
    expect(await accounts()).toEqual(before);
    expect(await all(db, "users")).toHaveLength(2);
  });

  test("sin sesión → 401", async () => {
    const res = await post("/v1/auth/link-social", { provider: "google", callbackURL: `${WEB_ORIGIN}/` });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("list-accounts y unlink-account", () => {
  async function anaWithTwo() {
    const session = await signIn("discord", ana);
    await oauth("google", anaGoogle);
    return session;
  }

  test("list-accounts devuelve las cuentas propias sin tokens", async () => {
    const session = await anaWithTwo();
    await signIn("discord", { ...ana, id: "2002", email: "beto@gmail.com", name: "Beto" });

    const list = await listAccounts(session);
    expect(LinkedAccountsSchema.parse(list).map((a) => a.providerId)).toEqual(["discord", "google"]);
    expect(Object.keys(list[0] ?? {}).sort()).toEqual([
      "accountId",
      "createdAt",
      "id",
      "providerId",
      "scopes",
      "updatedAt",
      "userId",
    ]);
    expect(JSON.stringify(list)).not.toMatch(/token/i);
  });

  test("con dos cuentas se desvincula una; la última no se puede quitar", async () => {
    const session = await anaWithTwo();
    const [discord, google] = LinkedAccountsSchema.parse(await listAccounts(session));

    const ok = await post("/v1/auth/unlink-account", { accountId: google?.id }, { cookie: session });
    expect(ok.status).toBe(200);
    expect(await ok.json<unknown>()).toEqual({ status: true });
    expect((await accounts()).map((a) => a.provider)).toEqual(["discord"]);

    const last = await post("/v1/auth/unlink-account", { accountId: discord?.id }, { cookie: session });
    expect(last.status).toBe(400);
    expect(await last.json()).toMatchObject({ code: "FAILED_TO_UNLINK_LAST_ACCOUNT" });
    expect((await accounts()).map((a) => a.provider)).toEqual(["discord"]);
  });

  test("no se puede desvincular la cuenta de otro usuario", async () => {
    const session = await anaWithTwo();
    const beto = await signIn("discord", { ...ana, id: "2002", email: "beto@gmail.com", name: "Beto" });
    const [betoAccount] = LinkedAccountsSchema.parse(await listAccounts(beto));

    const res = await post("/v1/auth/unlink-account", { accountId: betoAccount?.id }, { cookie: session });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    expect(await accounts()).toHaveLength(3);
  });

  test("desvincular pide una sesión de menos de un día", async () => {
    const session = await anaWithTwo();
    const [, google] = LinkedAccountsSchema.parse(await listAccounts(session));
    await db.query
      .updateTable("auth_sessions")
      .set({ created_at: daysAgo(2) })
      .execute();

    const res = await post("/v1/auth/unlink-account", { accountId: google?.id }, { cookie: session });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "SESSION_NOT_FRESH" });
    expect(await accounts()).toHaveLength(2);
  });
});

describe("origen y URLs de vuelta", () => {
  test("link-social y unlink-account sólo aceptan el Origin de la web", async () => {
    const session = await signIn("discord", ana);
    const body = { provider: "google", callbackURL: `${WEB_ORIGIN}/` };
    for (const [headers, code] of [
      [{ origin: "https://evil.example" }, "INVALID_ORIGIN"],
      [{ origin: "" }, "MISSING_OR_NULL_ORIGIN"],
    ] as const) {
      const link = await post("/v1/auth/link-social", body, { cookie: session, ...headers });
      expect(link.status).toBe(403);
      expect(await link.json()).toMatchObject({ code });
      const unlink = await post("/v1/auth/unlink-account", { accountId: "x" }, { cookie: session, ...headers });
      expect(unlink.status).toBe(403);
    }
  });

  test("callbackURL y errorCallbackURL deben ser de la web", async () => {
    const session = await signIn("discord", ana);
    const evil = "https://evil.example/robar";
    for (const [body, code] of [
      [{ callbackURL: evil }, "INVALID_CALLBACK_URL"],
      [{ callbackURL: `${WEB_ORIGIN}/`, errorCallbackURL: evil }, "INVALID_ERROR_CALLBACK_URL"],
    ] as const) {
      for (const path of ["/v1/auth/link-social", "/v1/auth/sign-in/social"]) {
        const res = await post(path, { provider: "google", ...body }, { cookie: session });
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code });
      }
    }
  });

  test("CORS con cookies para la web en las rutas de cuentas", async () => {
    for (const path of ["/v1/auth/link-social", "/v1/auth/unlink-account", "/v1/auth/list-accounts"]) {
      const res = await request(path, {
        method: "OPTIONS",
        headers: { origin: WEB_ORIGIN, "access-control-request-method": "POST" },
      });
      expect(res.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    }
  });
});
