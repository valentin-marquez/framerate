import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema, StoreDetailSchema, StoreListItemSchema, StoreMemberSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { z } from "zod";
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
const usernameOf = async (id: string) =>
  (await db.query.selectFrom("users").select("username").where("id", "=", id).executeTakeFirstOrThrow()).username;

/** Tienda "alfa" reclamada por su dueña. */
async function claimedStore() {
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
  await db.query.updateTable("stores").set({ organization_id: org.id }).where("slug", "=", "alfa").execute();
  return owner;
}

describe("listado de tiendas", () => {
  test("incluye dominio y si está reclamada; filtra por texto", async () => {
    await claimedStore();
    const res = await call("anon", "/v1/stores");
    const { items } = z.object({ items: z.array(StoreListItemSchema) }).parse(await res.json());
    expect(items.map((s) => [s.slug, s.domain, s.isClaimed])).toEqual([
      ["alfa", "alfa.cl", true],
      ["beta", "beta.cl", false],
    ]);
    const found = z
      .object({ items: z.array(StoreListItemSchema) })
      .parse(await (await call("anon", "/v1/stores?q=bet")).json());
    expect(found.items.map((s) => s.slug)).toEqual(["beta"]);
    const none = z
      .object({ items: z.array(StoreListItemSchema) })
      .parse(await (await call("anon", "/v1/stores?q=%25")).json());
    expect(none.items).toEqual([]);
  });
});

describe("perfil de la tienda", () => {
  test("lo edita la organización; vaciar un campo vuelve al dato canónico", async () => {
    const owner = await claimedStore();
    const ana = await who("Ana");
    expect((await call("anon", "/v1/stores/alfa", "PATCH", { description: "x" })).status).toBe(401);
    expect((await call(ana, "/v1/stores/alfa", "PATCH", { description: "x" })).status).toBe(403);

    const ok = await call(owner, "/v1/stores/alfa", "PATCH", {
      displayName: "  Alfa Gamer ",
      description: "Hardware",
      website: "https://alfa.cl",
      social: { instagram: "alfa" },
    });
    expect(ok.status).toBe(204);
    expect(StoreDetailSchema.parse(await (await call("anon", "/v1/stores/alfa")).json())).toMatchObject({
      name: "Alfa Gamer",
      description: "Hardware",
      website: "https://alfa.cl",
      social: { instagram: "alfa" },
    });

    await call(owner, "/v1/stores/alfa", "PATCH", { displayName: "" });
    expect(StoreDetailSchema.parse(await (await call("anon", "/v1/stores/alfa")).json())).toMatchObject({
      name: "alfa",
    });
  });

  test("valida el contenido", async () => {
    const owner = await claimedStore();
    expect((await call(owner, "/v1/stores/alfa", "PATCH", { website: "javascript:alert(1)" })).status).toBe(400);
    expect((await call(owner, "/v1/stores/alfa", "PATCH", { social: { myspace: "x" } })).status).toBe(400);
    expect((await call(owner, "/v1/stores/alfa", "PATCH", {})).status).toBe(400);
  });

  test("congelada: sólo el admin de la plataforma edita", async () => {
    const owner = await claimedStore();
    const admin = await who("Root", "admin");
    await db.query.updateTable("stores").set({ frozen_at: at }).where("slug", "=", "alfa").execute();
    const blocked = await call(owner, "/v1/stores/alfa", "PATCH", { description: "x" });
    expect(blocked.status).toBe(423);
    expect(await code(blocked)).toBe("store_frozen");
    expect((await call(admin, "/v1/stores/alfa", "PATCH", { description: "x" })).status).toBe(204);
  });
});

describe("miembros", () => {
  test("el dueño suma por nombre de usuario; sólo con rol admin/editor", async () => {
    const owner = await claimedStore();
    const ana = await who("Ana");
    const anaName = await usernameOf(ana);

    expect((await call(owner, "/v1/stores/alfa/members", "POST", { username: anaName, role: "owner" })).status).toBe(
      400,
    );
    expect(
      (await call(owner, "/v1/stores/alfa/members", "POST", { username: "nadie_existe", role: "editor" })).status,
    ).toBe(404);
    expect((await call(owner, "/v1/stores/alfa/members", "POST", { username: anaName, role: "editor" })).status).toBe(
      201,
    );
    expect(await code(await call(owner, "/v1/stores/alfa/members", "POST", { username: anaName, role: "admin" }))).toBe(
      "already_member",
    );

    const { items } = z
      .object({ items: z.array(StoreMemberSchema) })
      .parse(await (await call(ana, "/v1/stores/alfa/members")).json());
    expect(items.map((m) => m.role)).toEqual(["owner", "editor"]);
    // Ana ya es editora: puede editar el perfil y responder, pero no sumar gente.
    expect((await call(ana, "/v1/stores/alfa", "PATCH", { description: "ok" })).status).toBe(204);
    expect((await call(ana, "/v1/stores/alfa/members", "POST", { username: anaName, role: "editor" })).status).toBe(
      403,
    );
  });

  test("quitar: por jerarquía, y nunca al último dueño", async () => {
    const owner = await claimedStore();
    const [ana, beto] = [await who("Ana"), await who("Beto")];
    await call(owner, "/v1/stores/alfa/members", "POST", { username: await usernameOf(ana), role: "admin" });
    await call(owner, "/v1/stores/alfa/members", "POST", { username: await usernameOf(beto), role: "editor" });

    expect((await call(beto, `/v1/stores/alfa/members/${ana}`, "DELETE")).status).toBe(403);
    expect((await call(ana, `/v1/stores/alfa/members/${owner}`, "DELETE")).status).toBe(403);
    expect(await code(await call(owner, `/v1/stores/alfa/members/${owner}`, "DELETE"))).toBe("last_owner");
    expect((await call(ana, `/v1/stores/alfa/members/${beto}`, "DELETE")).status).toBe(204);
    expect((await call(ana, `/v1/stores/alfa/members/${ana}`, "DELETE")).status).toBe(204);
    expect(await all(db, "organization_members")).toHaveLength(1);
  });
});
