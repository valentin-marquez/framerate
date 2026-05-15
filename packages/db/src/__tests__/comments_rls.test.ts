/**
 * @file comments_rls.test.ts
 * Integration tests for the `comments` RLS policies, score trigger, and
 * soft-delete subtree preservation.
 *
 * Requires a running Supabase instance reachable via:
 *   SUPABASE_URL                 (e.g. http://127.0.0.1:54321)
 *   SUPABASE_SERVICE_ROLE_KEY    (service role, used to seed users + bypass RLS)
 *   SUPABASE_PUBLISHABLE_KEY     (anon key, used to authenticate as test users)
 *
 * The tests create their own users and tear them down at the end.
 *
 * Run from `packages/db/`: `bun test src/__tests__/comments_rls.test.ts`
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

const haveCreds = !!SERVICE_KEY && !!ANON_KEY;

// Skip the whole suite if creds aren't wired — keeps CI happy when local DB
// isn't available.
const skip = !haveCreds;

let admin: SupabaseClient;
let anonClient: SupabaseClient;

type Ctx = {
  client: SupabaseClient;
  userId: string;
  email: string;
  password: string;
};

const created = {
  users: [] as string[],
  productId: null as string | null,
  commentRootId: null as string | null,
};

async function makeUser(role?: "moderator" | "admin"): Promise<Ctx> {
  if (!admin) throw new Error("admin not initialised");
  const email = `test-${crypto.randomUUID()}@framerate.test`;
  const password = "test-password-12345";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.users.push(data.user.id);

  // Grant elevated role if asked.
  if (role) {
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: data.user.id, role });
    if (roleErr) throw new Error(`grant role failed: ${roleErr.message}`);
  }

  const client = createClient(SUPABASE_URL, ANON_KEY!);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);

  return { client, userId: data.user.id, email, password };
}

beforeAll(async () => {
  if (skip) return;
  admin = createClient(SUPABASE_URL, SERVICE_KEY!, { auth: { persistSession: false } });
  anonClient = createClient(SUPABASE_URL, ANON_KEY!, { auth: { persistSession: false } });

  // Find any existing product to attach comments to.
  const { data: products } = await admin.from("products").select("id").limit(1);
  if (!products || products.length === 0) {
    throw new Error("Need at least one product seeded in the local DB to run these tests.");
  }
  created.productId = products[0].id as string;
});

afterAll(async () => {
  if (skip || !admin) return;
  // Cleanup comments tied to our test users (cascades to votes + log).
  if (created.users.length > 0) {
    await admin.from("comments").delete().in("author_id", created.users);
    // Clean roles + users.
    await admin.from("user_roles").delete().in("user_id", created.users);
    for (const id of created.users) {
      await admin.auth.admin.deleteUser(id);
    }
  }
});

describe.if(haveCreds)("comments RLS", () => {
  test("anon cannot insert", async () => {
    const { error } = await anonClient.from("comments").insert({
      target_type: "product",
      target_id: created.productId,
      body: "anonymous attempt",
      author_id: "00000000-0000-0000-0000-000000000000",
      // path/root_id placeholders — RLS will reject before triggers run anyway.
      root_id: "00000000-0000-0000-0000-000000000000",
      path: "x",
    } as never);
    expect(error).not.toBeNull();
  });

  test("authenticated user can create root + trigger fills path/root/depth", async () => {
    const user = await makeUser();
    const { data, error } = await user.client
      .from("comments")
      .insert({
        target_type: "product",
        target_id: created.productId,
        body: "hello world",
        author_id: user.userId,
        root_id: user.userId,
        path: "placeholder",
      } as never)
      .select("id, root_id, depth, path, body")
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    if (!data) return;
    // biome-ignore lint/suspicious/noExplicitAny: types not regenerated yet
    const row = data as any;
    expect(row.depth).toBe(0);
    expect(row.root_id).toBe(row.id);
    expect(row.path).not.toBe("placeholder");
    created.commentRootId = row.id;
  });

  test("reply has depth=1 and shared root_id", async () => {
    const user = await makeUser();
    if (!created.commentRootId) throw new Error("need root from previous test");
    const { data, error } = await user.client
      .from("comments")
      .insert({
        target_type: "product",
        target_id: created.productId,
        parent_id: created.commentRootId,
        body: "reply",
        author_id: user.userId,
        root_id: user.userId, // will be overwritten by trigger
        path: "placeholder",
      } as never)
      .select("id, depth, root_id")
      .single();
    expect(error).toBeNull();
    if (!data) return;
    // biome-ignore lint/suspicious/noExplicitAny: types not regenerated yet
    const row = data as any;
    expect(row.depth).toBe(1);
    expect(row.root_id).toBe(created.commentRootId);
  });

  test("vote updates score via trigger", async () => {
    const voter = await makeUser();
    if (!created.commentRootId) throw new Error("need root");
    const { error } = await voter.client
      .from("comment_votes")
      .insert({ comment_id: created.commentRootId, user_id: voter.userId, value: 1 } as never);
    expect(error).toBeNull();

    const { data } = await admin.from("comments").select("score").eq("id", created.commentRootId).single();
    // biome-ignore lint/suspicious/noExplicitAny: types not regenerated yet
    expect((data as any)?.score).toBeGreaterThanOrEqual(1);
  });

  test("soft delete of root preserves subtree (replies still selectable)", async () => {
    if (!created.commentRootId) throw new Error("need root");
    // Soft-delete with service role to keep the test independent of who authored.
    await admin
      .from("comments")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason: "test",
      })
      .eq("id", created.commentRootId);

    // Walk the thread; the reply we created earlier should still be readable.
    const { data: thread } = await admin
      .from("comments")
      .select("id, parent_id, root_id, body, deleted_at")
      .eq("root_id", created.commentRootId);
    expect(thread).toBeTruthy();
    expect((thread || []).length).toBeGreaterThanOrEqual(2);
    // biome-ignore lint/suspicious/noExplicitAny: types not regenerated yet
    const root = (thread || []).find((c: any) => c.id === created.commentRootId);
    // biome-ignore lint/suspicious/noExplicitAny: types not regenerated yet
    const child = (thread || []).find((c: any) => c.parent_id === created.commentRootId);
    // biome-ignore lint/suspicious/noExplicitAny: types not regenerated yet
    expect((root as any).deleted_at).not.toBeNull();
    expect(child).toBeTruthy();
  });

  test("hard delete is denied for everyone via missing policy", async () => {
    const user = await makeUser();
    if (!created.commentRootId) throw new Error("need root");
    const { error: errSelf } = await user.client.from("comments").delete().eq("id", created.commentRootId);
    // No delete policy → silent no-op or RLS error. Either way the row must still exist.
    if (errSelf) expect(errSelf).toBeTruthy();
    const { data: still } = await admin.from("comments").select("id").eq("id", created.commentRootId).single();
    expect(still).toBeTruthy();
  });

  test("non-author cannot edit body", async () => {
    const stranger = await makeUser();
    if (!created.commentRootId) throw new Error("need root");
    // Insert a fresh comment by a different user.
    const author = await makeUser();
    const { data: c } = await author.client
      .from("comments")
      .insert({
        target_type: "product",
        target_id: created.productId,
        body: "owned by author",
        author_id: author.userId,
        root_id: author.userId,
        path: "placeholder",
      } as never)
      .select("id")
      .single();
    // biome-ignore lint/suspicious/noExplicitAny: types not regenerated yet
    const commentId = (c as any).id;
    const { data: updated, error } = await stranger.client
      .from("comments")
      .update({ body: "hacked" })
      .eq("id", commentId)
      .select();
    // RLS returns either an empty array or error.
    expect(error || (updated && updated.length === 0)).toBeTruthy();
  });

  test("moderator can soft-delete any comment", async () => {
    const author = await makeUser();
    const mod = await makeUser("moderator");
    const { data: c } = await author.client
      .from("comments")
      .insert({
        target_type: "product",
        target_id: created.productId,
        body: "to be moderated",
        author_id: author.userId,
        root_id: author.userId,
        path: "placeholder",
      } as never)
      .select("id")
      .single();
    // biome-ignore lint/suspicious/noExplicitAny: types not regenerated yet
    const cid = (c as any).id;

    const { data: updated, error } = await mod.client
      .from("comments")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: mod.userId,
        deleted_reason: "spam",
      })
      .eq("id", cid)
      .select();
    expect(error).toBeNull();
    expect(updated?.length).toBeGreaterThan(0);
  });
});
