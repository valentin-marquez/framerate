/**
 * @file store-reviews.test.ts
 *
 * Fase 2: Tests integrales de los endpoints de reseñas de tienda.
 * Llama a las sub-apps Hono directamente via app.request(), simulando bindings.
 *
 * Ejecutar: `bun test apps/api/src/routes/__tests__/store-reviews.test.ts`
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { storeReviewsById, storeReviewsByStore } from "@/routes/store-reviews";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Bindings mock: en local Bun, Cache API no existe; el middleware Cache lo
// detecta y se hace bypass. RateLimit no se aplica porque las sub-apps no lo
// montan internamente.
// biome-ignore lint/suspicious/noExplicitAny: minimal bindings stub
const ENV: any = {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
};

interface Ctx {
  admin: SupabaseClient;
  storeId: string;
  storeSlug: string;
  authorUserId: string;
  authorToken: string;
  otherUserId: string;
  otherToken: string;
  reviewId?: string;
}

const ctx = {} as Ctx;

async function createUser(admin: SupabaseClient, email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u) => u.email === email);
      if (found) return found;
    }
    throw error;
  }
  return data.user;
}

async function getToken(email: string, password: string) {
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("No session");
  return data.session.access_token;
}

beforeAll(async () => {
  ctx.admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const storeSlug = `test-store-api-${Date.now()}`;
  const { data: store, error: storeErr } = await ctx.admin
    .from("stores")
    .insert({
      slug: storeSlug,
      name: "Test Store API",
      url: "https://example.test",
      is_active: true,
      appearance: "dark",
    })
    .select()
    .single();
  if (storeErr || !store) throw storeErr ?? new Error("Could not create test store");
  ctx.storeId = store.id;
  ctx.storeSlug = store.slug;

  const password = "test1234password";
  const authorEmail = `author-api-${Date.now()}@test.local`;
  const otherEmail = `other-api-${Date.now()}@test.local`;
  const author = await createUser(ctx.admin, authorEmail, password);
  const other = await createUser(ctx.admin, otherEmail, password);

  await ctx.admin.from("profiles").upsert([
    { id: author.id, username: `api-author-${Date.now()}`, full_name: "Author" },
    { id: other.id, username: `api-other-${Date.now()}`, full_name: "Other" },
  ]);

  ctx.authorUserId = author.id;
  ctx.otherUserId = other.id;
  ctx.authorToken = await getToken(authorEmail, password);
  ctx.otherToken = await getToken(otherEmail, password);
});

afterAll(async () => {
  if (!ctx.admin) return;
  if (ctx.reviewId) await ctx.admin.from("store_reviews").delete().eq("id", ctx.reviewId);
  if (ctx.storeId) await ctx.admin.from("stores").delete().eq("id", ctx.storeId);
  if (ctx.authorUserId) await ctx.admin.auth.admin.deleteUser(ctx.authorUserId);
  if (ctx.otherUserId) await ctx.admin.auth.admin.deleteUser(ctx.otherUserId);
});

function jsonReq(url: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  return new Request(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

describe("store-reviews endpoints", () => {
  test("GET /:slug/reviews/stats returns empty stats for fresh store", async () => {
    const res = await storeReviewsByStore.request(
      jsonReq(`http://test.local/${ctx.storeSlug}/reviews/stats`),
      undefined,
      ENV,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { total_reviews: number };
    expect(data.total_reviews).toBe(0);
  });

  test("POST /:slug/reviews requires auth", async () => {
    const res = await storeReviewsByStore.request(
      jsonReq(`http://test.local/${ctx.storeSlug}/reviews`, {
        method: "POST",
        body: { rating: 4, comment: "Nice" },
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(401);
  });

  test("POST /:slug/reviews validates rating", async () => {
    const res = await storeReviewsByStore.request(
      jsonReq(`http://test.local/${ctx.storeSlug}/reviews`, {
        method: "POST",
        token: ctx.authorToken,
        body: { rating: 99, comment: "Bad" },
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(400);
  });

  test("POST /:slug/reviews creates a review", async () => {
    const res = await storeReviewsByStore.request(
      jsonReq(`http://test.local/${ctx.storeSlug}/reviews`, {
        method: "POST",
        token: ctx.authorToken,
        body: { rating: 5, comment: "Excellent" },
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; rating: number };
    expect(body.rating).toBe(5);
    ctx.reviewId = body.id;
  });

  test("POST /:slug/reviews blocks duplicate active review", async () => {
    const res = await storeReviewsByStore.request(
      jsonReq(`http://test.local/${ctx.storeSlug}/reviews`, {
        method: "POST",
        token: ctx.authorToken,
        body: { rating: 3, comment: "Try again" },
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(409);
  });

  test("GET /:slug/reviews lists reviews", async () => {
    const res = await storeReviewsByStore.request(
      jsonReq(`http://test.local/${ctx.storeSlug}/reviews?sort=recent`),
      undefined,
      ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }>; meta: { total: number } };
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
    expect(body.data.some((r) => r.id === ctx.reviewId)).toBe(true);
  });

  test("PATCH /:id by author updates rating/comment", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}`, {
        method: "PATCH",
        token: ctx.authorToken,
        body: { rating: 4, comment: "Edited" },
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rating: number; comment: string };
    expect(body.rating).toBe(4);
    expect(body.comment).toBe("Edited");
  });

  test("PATCH /:id by non-author with author fields returns 403", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}`, {
        method: "PATCH",
        token: ctx.otherToken,
        body: { rating: 1 },
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(403);
  });

  test("PATCH /:id mixing author and owner fields returns 400", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}`, {
        method: "PATCH",
        token: ctx.authorToken,
        body: { rating: 5, owner_response: "Thanks!" },
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(400);
  });

  test("PATCH /:id owner fields without role returns 403", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}`, {
        method: "PATCH",
        token: ctx.otherToken,
        body: { owner_response: "Hi" },
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(403);
  });

  test("POST /:id/helpful marks vote", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}/helpful`, {
        method: "POST",
        token: ctx.otherToken,
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(200);
  });

  test("POST /:id/helpful again is idempotent", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}/helpful`, {
        method: "POST",
        token: ctx.otherToken,
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { already: boolean };
    expect(body.already).toBe(true);
  });

  test("DELETE /:id/helpful removes the vote", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}/helpful`, {
        method: "DELETE",
        token: ctx.otherToken,
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(200);
  });

  test("DELETE /:id by author soft-deletes", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}`, {
        method: "DELETE",
        token: ctx.authorToken,
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(200);

    // El listado público debe esconder el contenido del comment
    const list = await storeReviewsByStore.request(
      jsonReq(`http://test.local/${ctx.storeSlug}/reviews`),
      undefined,
      ENV,
    );
    const body = (await list.json()) as { data: Array<{ id: string; deleted?: boolean }> };
    const found = body.data.find((r) => r.id === ctx.reviewId);
    expect(found?.deleted).toBe(true);
  });

  test("DELETE /:id again returns 410", async () => {
    const res = await storeReviewsById.request(
      jsonReq(`http://test.local/${ctx.reviewId}`, {
        method: "DELETE",
        token: ctx.authorToken,
      }),
      undefined,
      ENV,
    );
    expect(res.status).toBe(410);
  });
});
