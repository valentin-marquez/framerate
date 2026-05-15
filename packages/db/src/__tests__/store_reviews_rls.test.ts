/**
 * @file store_reviews_rls.test.ts
 *
 * Fase 2: Tests de RLS para store_reviews + store_review_helpful.
 *
 * Asume que la instancia local de Supabase está corriendo en :54321 con el
 * service_role y anon keys por defecto. Si los cambian, ajustar las constantes.
 *
 * Ejecutar: `bun test packages/db/src/__tests__/store_reviews_rls.test.ts`
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

interface Ctx {
  admin: SupabaseClient;
  storeId: string;
  storeSlug: string;
  authorUserId: string;
  authorToken: string;
  authorClient: SupabaseClient;
  otherUserId: string;
  otherToken: string;
  otherClient: SupabaseClient;
  reviewId: string;
}

const ctx = {} as Ctx;

async function createUser(admin: SupabaseClient, email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
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

function clientWithToken(token: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

beforeAll(async () => {
  ctx.admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const storeSlug = `test-store-rls-${Date.now()}`;
  const { data: store, error: storeErr } = await ctx.admin
    .from("stores")
    .insert({
      slug: storeSlug,
      name: "Test Store RLS",
      url: "https://example.test",
      is_active: true,
      appearance: "dark",
    })
    .select()
    .single();
  if (storeErr || !store) throw storeErr ?? new Error("Could not create test store");

  ctx.storeId = store.id;
  ctx.storeSlug = store.slug;

  const authorEmail = `author-rls-${Date.now()}@test.local`;
  const otherEmail = `other-rls-${Date.now()}@test.local`;
  const password = "test1234password";

  const author = await createUser(ctx.admin, authorEmail, password);
  const other = await createUser(ctx.admin, otherEmail, password);

  await ctx.admin.from("profiles").upsert([
    { id: author.id, username: `author-${Date.now()}`, full_name: "Author" },
    { id: other.id, username: `other-${Date.now()}`, full_name: "Other" },
  ]);

  ctx.authorUserId = author.id;
  ctx.otherUserId = other.id;

  ctx.authorToken = await getToken(authorEmail, password);
  ctx.otherToken = await getToken(otherEmail, password);

  ctx.authorClient = clientWithToken(ctx.authorToken);
  ctx.otherClient = clientWithToken(ctx.otherToken);

  const { data: review, error: reviewErr } = await ctx.authorClient
    .from("store_reviews")
    .insert({
      store_id: ctx.storeId,
      user_id: ctx.authorUserId,
      rating: 5,
      comment: "Great store",
    })
    .select()
    .single();
  if (reviewErr || !review) throw reviewErr ?? new Error("Could not create test review");
  ctx.reviewId = review.id;
});

afterAll(async () => {
  if (!ctx.admin) return;
  if (ctx.reviewId) {
    await ctx.admin.from("store_reviews").delete().eq("id", ctx.reviewId);
  }
  if (ctx.storeId) {
    await ctx.admin.from("stores").delete().eq("id", ctx.storeId);
  }
  if (ctx.authorUserId) await ctx.admin.auth.admin.deleteUser(ctx.authorUserId);
  if (ctx.otherUserId) await ctx.admin.auth.admin.deleteUser(ctx.otherUserId);
});

describe("store_reviews RLS", () => {
  test("anon can SELECT reviews (public read)", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await anon.from("store_reviews").select("*").eq("id", ctx.reviewId);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  test("anon cannot INSERT reviews", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await anon
      .from("store_reviews")
      .insert({ store_id: ctx.storeId, user_id: ctx.authorUserId, rating: 3 });
    expect(error).not.toBeNull();
  });

  test("author can UPDATE their own comment", async () => {
    const { error } = await ctx.authorClient
      .from("store_reviews")
      .update({ comment: "Updated comment" })
      .eq("id", ctx.reviewId);
    expect(error).toBeNull();
  });

  test("non-author cannot UPDATE another user's review (no store-member role)", async () => {
    // El stub is_store_member retorna false (Fase 0 stub) por lo que la policy
    // "Store members can respond" no aplica. La policy "Users can update own"
    // tampoco aplica porque no es autor. La de moderator solo si authorize(mod).
    const { data, error } = await ctx.otherClient
      .from("store_reviews")
      .update({ comment: "Hacked!" })
      .eq("id", ctx.reviewId)
      .select();
    // RLS bloquea: no error pero data vacía (no se actualizó ninguna fila).
    expect(error?.message ?? "").not.toContain("permission");
    expect(data?.length ?? 0).toBe(0);
  });

  test("comment length constraint blocks > 2000 chars", async () => {
    const long = "x".repeat(2001);
    const { error } = await ctx.authorClient.from("store_reviews").update({ comment: long }).eq("id", ctx.reviewId);
    expect(error).not.toBeNull();
    expect((error?.message ?? "").toLowerCase()).toContain("check");
  });

  test("helpful vote insert/delete updates helpful_count via trigger", async () => {
    const { error: insErr } = await ctx.otherClient
      .from("store_review_helpful")
      .insert({ review_id: ctx.reviewId, user_id: ctx.otherUserId });
    expect(insErr).toBeNull();

    const { data: r1 } = await ctx.admin.from("store_reviews").select("helpful_count").eq("id", ctx.reviewId).single();
    expect(r1?.helpful_count).toBe(1);

    const { error: delErr } = await ctx.otherClient
      .from("store_review_helpful")
      .delete()
      .eq("review_id", ctx.reviewId)
      .eq("user_id", ctx.otherUserId);
    expect(delErr).toBeNull();

    const { data: r2 } = await ctx.admin.from("store_reviews").select("helpful_count").eq("id", ctx.reviewId).single();
    expect(r2?.helpful_count).toBe(0);
  });

  test("user cannot vote helpful on behalf of another user", async () => {
    const { error } = await ctx.otherClient
      .from("store_review_helpful")
      .insert({ review_id: ctx.reviewId, user_id: ctx.authorUserId });
    expect(error).not.toBeNull();
  });

  test("get_store_rating_stats RPC returns aggregates", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await anon.rpc("get_store_rating_stats", { p_store_slug: ctx.storeSlug });
    expect(error).toBeNull();
    expect(data).toBeDefined();
    // biome-ignore lint/suspicious/noExplicitAny: shape verificado en runtime
    const stats = data as any;
    expect(stats.total_reviews).toBeGreaterThanOrEqual(1);
    expect(stats.distribution).toBeDefined();
    expect(stats.distribution["5"]).toBeGreaterThanOrEqual(1);
  });

  test("get_store_rating_stats returns zeros for unknown slug", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await anon.rpc("get_store_rating_stats", { p_store_slug: "no-such-store-xyz" });
    expect(error).toBeNull();
    // biome-ignore lint/suspicious/noExplicitAny: shape verificado en runtime
    const stats = data as any;
    expect(stats.total_reviews).toBe(0);
  });

  test("admin (service_role) can soft-delete a review", async () => {
    const { error } = await ctx.admin
      .from("store_reviews")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: ctx.otherUserId,
        deleted_reason: "test moderation",
      })
      .eq("id", ctx.reviewId);
    expect(error).toBeNull();

    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data } = await anon.rpc("get_store_rating_stats", { p_store_slug: ctx.storeSlug });
    // biome-ignore lint/suspicious/noExplicitAny: shape verificado en runtime
    const stats = data as any;
    expect(stats.total_reviews).toBe(0);

    await ctx.admin
      .from("store_reviews")
      .update({ deleted_at: null, deleted_by: null, deleted_reason: null })
      .eq("id", ctx.reviewId);
  });
});
