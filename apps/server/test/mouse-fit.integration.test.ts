import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, sessionHeaders, testEnv, WEB_ORIGIN } from "./helpers";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
const realFetch = globalThis.fetch;
let turnstilePasses = true;

const hand = { length_mm: 190, width_mm: 95, grip: "palm" };
const report = { ...hand, product_slug: "mouse-uno", fit: "right" };

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1, {}, { TURNSTILE_SECRET_KEY: "test-turnstile-secret" }));
});
afterAll(() => dispose());
beforeEach(async () => {
  turnstilePasses = true;
  globalThis.fetch = (async () => Response.json({ success: turnstilePasses })) as unknown as typeof fetch;
  await resetD1(d1);
  const now = new Date().toISOString();
  await db.query
    .insertInto("products")
    .values([
      {
        slug: "mouse-uno",
        name: "Mouse Uno",
        category: "mouse",
        search: "mouse uno",
        created_at: now,
        updated_at: now,
      },
      { slug: "gpu-una", name: "GPU Una", category: "gpu", search: "gpu una", created_at: now, updated_at: now },
    ])
    .execute();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function call(actor: string, path: string, method = "GET", body?: unknown) {
  const headers = new Headers({ "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" });
  if (actor !== "anon") {
    for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
    headers.set("origin", WEB_ORIGIN);
  }
  return app.request(path, { method, headers, body: body ? JSON.stringify(body) : undefined }, env);
}
const handOf = async (userId: string): Promise<unknown> => (await call(userId, "/v1/me/hand")).json();
const reports = () => db.query.selectFrom("mouse_fit_reports").selectAll().execute();

describe("perfil de mano", () => {
  test("sin sesión no hay perfil", async () => {
    expect((await call("anon", "/v1/me/hand")).status).toBe(401);
  });

  test("se guarda, se lee y se borra", async () => {
    const userId = await createUser(env, db, { name: "Mano" });
    expect(await handOf(userId)).toEqual({ hand: null });
    expect((await call(userId, "/v1/me/hand", "PUT", hand)).status).toBe(200);
    expect((await call(userId, "/v1/me/hand", "PUT", { ...hand, length_mm: 200 })).status).toBe(200);
    expect(await handOf(userId)).toEqual({ hand: { ...hand, length_mm: 200 } });
    expect((await call(userId, "/v1/me/hand", "DELETE")).status).toBe(204);
    expect(await handOf(userId)).toEqual({ hand: null });
  });

  test("una medida imposible no se guarda", async () => {
    const userId = await createUser(env, db, { name: "Mano" });
    expect((await call(userId, "/v1/me/hand", "PUT", { ...hand, length_mm: 19 })).status).toBe(400);
  });
});

describe("casos de calibración", () => {
  test("sin sesión exige Turnstile", async () => {
    turnstilePasses = false;
    expect((await call("anon", "/v1/mouse-fit/reports", "POST", { ...report, turnstileToken: "x" })).status).toBe(400);
    expect((await call("anon", "/v1/mouse-fit/reports", "POST", report)).status).toBe(400);
    expect(await reports()).toHaveLength(0);
  });

  test("con Turnstile válido se guarda", async () => {
    const res = await call("anon", "/v1/mouse-fit/reports", "POST", { ...report, turnstileToken: "x" });
    expect(res.status).toBe(204);
    expect(await reports()).toHaveLength(1);
  });

  test("con sesión no pide Turnstile, y el caso no guarda nada que identifique", async () => {
    turnstilePasses = false;
    const userId = await createUser(env, db, { name: "Mano" });
    expect((await call(userId, "/v1/mouse-fit/reports", "POST", report)).status).toBe(204);
    const [row] = await reports();
    expect(Object.keys(row ?? {}).sort()).toEqual(
      ["fit", "grip", "hand_length_mm", "hand_width_mm", "id", "product_id", "reported_on"].sort(),
    );
    expect(String(row?.reported_on)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("un producto que no es mouse se rechaza", async () => {
    const userId = await createUser(env, db, { name: "Mano" });
    const res = await call(userId, "/v1/mouse-fit/reports", "POST", { ...report, product_slug: "gpu-una" });
    expect(res.status).toBe(404);
    expect(await reports()).toHaveLength(0);
  });

  test("si el producto se borra, el caso queda sin producto", async () => {
    const userId = await createUser(env, db, { name: "Mano" });
    await call(userId, "/v1/mouse-fit/reports", "POST", report);
    await db.query.deleteFrom("products").where("slug", "=", "mouse-uno").execute();
    expect(await reports()).toMatchObject([{ product_id: null }]);
  });
});
