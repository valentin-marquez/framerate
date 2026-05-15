/**
 * @file comments.test.ts
 * Smoke tests for the Fase 3 comments API.
 *
 * These tests run the Hono app directly against a local Supabase instance.
 * Requirements:
 *   - SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY env vars
 *   - At least one product seeded in the local DB
 *
 * Run from `apps/api/`: `bun test src/routes/__tests__/comments.test.ts`
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import comments from "@/routes/comments";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

const haveCreds = !!SERVICE_KEY && !!ANON_KEY;

interface TestUser {
  userId: string;
  token: string;
}

let admin: SupabaseClient;
let app: Hono;
let productId: string | null = null;
const cleanupUserIds: string[] = [];

async function makeUser(): Promise<TestUser> {
  const email = `api-test-${crypto.randomUUID()}@framerate.test`;
  const password = "test-password-12345";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message);
  cleanupUserIds.push(data.user.id);

  const anon = createClient(SUPABASE_URL, ANON_KEY!);
  const { data: session, error: signErr } = await anon.auth.signInWithPassword({ email, password });
  if (signErr || !session.session) throw new Error(signErr?.message || "no session");
  return { userId: data.user.id, token: session.session.access_token };
}

async function call(method: string, path: string, opts: { body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  return app.request(path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

beforeAll(async () => {
  if (!haveCreds) return;
  admin = createClient(SUPABASE_URL, SERVICE_KEY!, { auth: { persistSession: false } });

  const { data: products } = await admin.from("products").select("id").limit(1);
  if (!products || products.length === 0) {
    throw new Error("Need at least one product seeded in the local DB.");
  }
  productId = products[0].id as string;

  // Build the app with env injected. Hono Cache middleware tolerates absence
  // of `caches` global; our `Cache()` middleware is no-op in node/bun.
  app = new Hono();
  app.use("*", async (c, next) => {
    c.env = {
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
      // Stub rate limiters → success: true.
      STRICT_RATE_LIMITER: { limit: async () => ({ success: true }) },
      MODERATE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      LENIENT_RATE_LIMITER: { limit: async () => ({ success: true }) },
      SEARCH_RATE_LIMITER: { limit: async () => ({ success: true }) },
      // biome-ignore lint/suspicious/noExplicitAny: stub env for tests
    } as any;
    await next();
  });
  app.route("/v1", comments);
});

afterAll(async () => {
  if (!haveCreds) return;
  if (cleanupUserIds.length > 0) {
    await admin.from("comments").delete().in("author_id", cleanupUserIds);
    await admin.from("user_roles").delete().in("user_id", cleanupUserIds);
    for (const id of cleanupUserIds) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        // ignore
      }
    }
  }
});

describe.if(haveCreds)("Fase 3 comments API", () => {
  test("anon GET /products/:id/comments returns 200 with data array", async () => {
    if (!productId) throw new Error("no product");
    const res = await call("GET", `/v1/products/${productId}/comments`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("anon POST is rejected with 401", async () => {
    if (!productId) throw new Error("no product");
    const res = await call("POST", `/v1/products/${productId}/comments`, { body: { body: "anon attempt" } });
    expect(res.status).toBe(401);
  });

  test("happy path: create root, reply, fetch thread, vote, soft delete", async () => {
    if (!productId) throw new Error("no product");
    const user = await makeUser();

    // 1. Create root.
    const createRes = await call("POST", `/v1/products/${productId}/comments`, {
      token: user.token,
      body: { body: "Root comment from API test" },
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string; root_id: string } };
    const rootId = created.data.id;
    expect(created.data.root_id).toBe(rootId);

    // 2. Create reply.
    const replyRes = await call("POST", `/v1/products/${productId}/comments`, {
      token: user.token,
      body: { parent_id: rootId, body: "Reply to root" },
    });
    expect(replyRes.status).toBe(201);

    // 3. Fetch thread.
    const threadRes = await call("GET", `/v1/comments/${rootId}/thread`);
    expect(threadRes.status).toBe(200);
    const thread = (await threadRes.json()) as { data: { id: string; depth: number }[] };
    expect(thread.data.length).toBeGreaterThanOrEqual(2);
    const depths = thread.data.map((n) => n.depth);
    expect(depths).toContain(0);
    expect(depths).toContain(1);

    // 4. Vote (upvote).
    const voteRes = await call("POST", `/v1/comments/${rootId}/vote`, { token: user.token, body: { value: 1 } });
    expect(voteRes.status).toBe(200);
    const voted = (await voteRes.json()) as { data: { score: number } };
    expect(voted.data.score).toBeGreaterThanOrEqual(1);

    // 5. Clear vote.
    const clearRes = await call("POST", `/v1/comments/${rootId}/vote`, { token: user.token, body: { value: 0 } });
    expect(clearRes.status).toBe(200);

    // 6. Soft delete (as author).
    const delRes = await call("DELETE", `/v1/comments/${rootId}`, { token: user.token });
    expect(delRes.status).toBe(200);

    // 7. Refetch thread → root body is redacted but the reply is still readable.
    const after = await call("GET", `/v1/comments/${rootId}/thread`);
    const afterJson = (await after.json()) as {
      data: { id: string; body: string | null; deleted_at: string | null }[];
    };
    const rootAfter = afterJson.data.find((n) => n.id === rootId);
    const reply = afterJson.data.find((n) => n.id !== rootId);
    expect(rootAfter?.body).toBeNull();
    expect(rootAfter?.deleted_at).not.toBeNull();
    expect(reply?.body).not.toBeNull();
  });

  test("edit window: PATCH succeeds within 5 minutes", async () => {
    if (!productId) throw new Error("no product");
    const user = await makeUser();
    const createRes = await call("POST", `/v1/products/${productId}/comments`, {
      token: user.token,
      body: { body: "Initial body" },
    });
    const c = (await createRes.json()) as { data: { id: string } };
    const editRes = await call("PATCH", `/v1/comments/${c.data.id}`, {
      token: user.token,
      body: { body: "Edited body" },
    });
    expect(editRes.status).toBe(200);
    const edited = (await editRes.json()) as { data: { body: string; edited_at: string | null } };
    expect(edited.data.body).toBe("Edited body");
    expect(edited.data.edited_at).not.toBeNull();
  });
});
