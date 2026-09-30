import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema, ClaimSchema, DnsCheckSchema, VerifyResultSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, seedCatalog, sessionHeaders, testEnv, WEB_ORIGIN } from "./helpers";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
const realFetch = globalThis.fetch;

/** DNS simulado: los dos resolvers responden lo mismo. `txt` = registros TXT por nombre. */
let txt: Record<string, string[]> = {};
function stubDns() {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const name = url.searchParams.get("name") ?? "";
    const type = url.searchParams.get("type");
    if (type === "NS") {
      return Response.json({ Status: 0, Answer: [{ type: 2, data: "lara.ns.cloudflare.com." }] });
    }
    const records = txt[name];
    return Response.json(
      records ? { Status: 0, Answer: records.map((r) => ({ type: 16, data: `"${r}"` })) } : { Status: 3 },
    );
  }) as typeof fetch;
}

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
});
afterAll(() => dispose());
beforeEach(() => {
  txt = {};
  stubDns();
  return resetD1(d1);
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

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
const json = async <T>(res: Response) => (await res.json()) as T;

async function startClaim(user: string) {
  const res = await call(user, "/v1/claims", "POST", { storeSlug: "alfa" });
  expect(res.status).toBe(201);
  return ClaimSchema.parse(await res.json());
}
/** Salta el enfriamiento entre verificaciones. */
const rewindCooldown = () =>
  db.query.updateTable("store_claims").set({ last_attempt_at: "2020-01-01T00:00:00Z" }).execute();

describe("crear el reclamo", () => {
  test("genera nombre y valor del TXT y detecta el proveedor", async () => {
    await seedCatalog(db);
    const claim = await startClaim(await who("Ana"));
    expect(claim).toMatchObject({
      storeSlug: "alfa",
      domain: "alfa.cl",
      txtName: "_framerate-verify.alfa.cl",
      status: "pending",
      dnsProvider: "cloudflare",
    });
    expect(claim.txtValue).toMatch(/^framerate-verify=v1:[0-9a-f]{32}$/);
  });

  test("exige sesión, y una tienda sin reclamar y sin otro reclamo en curso", async () => {
    await seedCatalog(db);
    const [ana, beto] = [await who("Ana"), await who("Beto")];
    expect((await call("anon", "/v1/claims", "POST", { storeSlug: "alfa" })).status).toBe(401);
    expect((await call(ana, "/v1/claims", "POST", { storeSlug: "nada" })).status).toBe(404);
    await startClaim(ana);
    const second = await call(beto, "/v1/claims", "POST", { storeSlug: "alfa" });
    expect(second.status).toBe(409);
    expect(await code(second)).toBe("claim_in_progress");
  });

  test("una tienda sin dominio no se puede reclamar", async () => {
    await seedCatalog(db);
    await db.query.updateTable("stores").set({ domain: null }).where("slug", "=", "alfa").execute();
    expect(await code(await call(await who("Ana"), "/v1/claims", "POST", { storeSlug: "alfa" }))).toBe("no_domain");
  });
});

describe("verificar", () => {
  test("pending → verified cuando ambos resolvers ven el TXT; el peek no escribe", async () => {
    await seedCatalog(db);
    const ana = await who("Ana");
    const claim = await startClaim(ana);

    const peek = DnsCheckSchema.parse(await (await call(ana, `/v1/claims/${claim.id}/dns-check`)).json());
    expect(peek).toMatchObject({ status: "pending", matched: false, found: [] });

    txt["_framerate-verify.alfa.cl"] = ["otra-cosa"];
    const wrong = VerifyResultSchema.parse(await (await call(ana, `/v1/claims/${claim.id}/verify`, "POST")).json());
    expect(wrong).toMatchObject({ status: "mismatch", claimStatus: "pending", found: ["otra-cosa"], attempts: 1 });

    txt["_framerate-verify.alfa.cl"] = [claim.txtValue];
    const tooSoon = await call(ana, `/v1/claims/${claim.id}/verify`, "POST");
    expect(tooSoon.status).toBe(429);

    await rewindCooldown();
    const ok = VerifyResultSchema.parse(await (await call(ana, `/v1/claims/${claim.id}/verify`, "POST")).json());
    expect(ok).toMatchObject({ status: "verified", matched: true, claimStatus: "verified", attempts: 2 });
    const [row] = await all(db, "store_claims");
    expect(row).toMatchObject({ status: "verified" });
  });

  test("un reclamo ajeno no existe para otros; uno vencido responde 410", async () => {
    await seedCatalog(db);
    const [ana, beto] = [await who("Ana"), await who("Beto")];
    const claim = await startClaim(ana);
    expect((await call(beto, `/v1/claims/${claim.id}/verify`, "POST")).status).toBe(404);

    await db.query.updateTable("store_claims").set({ expires_at: "2020-01-01T00:00:00Z" }).execute();
    const expired = await call(ana, `/v1/claims/${claim.id}/verify`, "POST");
    expect(expired.status).toBe(410);
    const [row] = await all(db, "store_claims");
    expect(row).toMatchObject({ status: "expired" });
  });
});

describe("confirmar", () => {
  test("sin verificar no se puede; verificado crea la organización y deja al usuario como dueño", async () => {
    await seedCatalog(db);
    const ana = await who("Ana");
    const claim = await startClaim(ana);
    const early = await call(ana, `/v1/claims/${claim.id}/confirm`, "POST");
    expect(early.status).toBe(409);
    expect(await code(early)).toBe("claim_not_verified");

    txt["_framerate-verify.alfa.cl"] = [claim.txtValue];
    await call(ana, `/v1/claims/${claim.id}/verify`, "POST");
    const done = await call(ana, `/v1/claims/${claim.id}/confirm`, "POST");
    expect(done.status).toBe(200);

    expect(await json<unknown>(await call(ana, "/v1/stores/alfa/me"))).toEqual({ role: "owner" });
    const store = await json<{ isClaimed: boolean; verifiedAt: string | null }>(await call("anon", "/v1/stores/alfa"));
    expect(store.isClaimed).toBe(true);
    expect(store.verifiedAt).not.toBeNull();

    const again = await call(await who("Beto"), "/v1/claims", "POST", { storeSlug: "alfa" });
    expect(await code(again)).toBe("already_claimed");
    const events = (await all(db, "store_claim_events")).map((e) => e.action);
    expect(events).toEqual(["created", "verified", "confirmed"]);
  });
});

describe("revocar (personal)", () => {
  test("desvincula la tienda pero conserva a los miembros y deja auditoría", async () => {
    await seedCatalog(db);
    const [ana, mod] = [await who("Ana"), await who("Mod", "moderator")];
    const claim = await startClaim(ana);
    txt["_framerate-verify.alfa.cl"] = [claim.txtValue];
    await call(ana, `/v1/claims/${claim.id}/verify`, "POST");
    await call(ana, `/v1/claims/${claim.id}/confirm`, "POST");

    expect((await call(ana, `/v1/admin/claims/${claim.id}/revoke`, "POST")).status).toBe(403);
    expect((await call(mod, `/v1/admin/claims/${claim.id}/revoke`, "POST", { reason: "disputa" })).status).toBe(204);

    const store = await json<{ isClaimed: boolean }>(await call("anon", "/v1/stores/alfa"));
    expect(store.isClaimed).toBe(false);
    expect(await all(db, "organization_members")).toHaveLength(1);
    expect((await all(db, "moderation_actions")).map((a) => a.action)).toEqual(["claim_revoked"]);
    expect((await call(mod, `/v1/admin/claims/${claim.id}/revoke`, "POST")).status).toBe(409);

    const reclaim = await call(await who("Beto"), "/v1/claims", "POST", { storeSlug: "alfa" });
    expect(reclaim.status).toBe(201);
  });
});
