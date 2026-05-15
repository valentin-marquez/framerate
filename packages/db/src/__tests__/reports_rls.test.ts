/**
 * Reports + moderation RLS tests.
 *
 * Estos tests apuntan a la instancia local de Supabase (`bun x supabase
 * start`). El service-role bypassea RLS asi que lo usamos para crear
 * fixtures de users; los assertions de policy se ejecutan con clients
 * autenticados.
 *
 * Para correrlos:
 *
 *   bun x supabase start   # desde packages/db
 *   bun test packages/db/src/__tests__/reports_rls.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // JWT service-role default de la instancia local (`bun x supabase status`).
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Skip toda la suite si la instancia no esta levantada.
const isLocalUp = await fetch(`${SUPABASE_URL}/auth/v1/health`)
  .then((r) => r.ok)
  .catch(() => false);

const maybeDescribe = isLocalUp ? describe : describe.skip;

interface UserCtx {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient<Database>;
}

const TEST_PRODUCT_ID = "00000000-0000-0000-0000-000000000aaa";

async function createUser(admin: SupabaseClient<Database>, suffix: string): Promise<UserCtx> {
  const email = `phase4-${suffix}-${Date.now()}@framerate.test`;
  const password = "phase4-test-password-1234";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Failed to create user: ${error?.message}`);

  const client = createClient<Database>(SUPABASE_URL, ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Failed to sign in: ${signInError.message}`);

  return { id: data.user.id, email, password, client };
}

async function setRole(admin: SupabaseClient<Database>, userId: string, role: "user" | "moderator" | "admin") {
  await admin.from("user_roles").upsert({ user_id: userId, role });
}

maybeDescribe("reports RLS", () => {
  let admin: SupabaseClient<Database>;
  let alice: UserCtx;
  let bob: UserCtx;
  let mod: UserCtx;
  let adminUser: UserCtx;
  const createdReportIds: string[] = [];

  beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    alice = await createUser(admin, "alice");
    bob = await createUser(admin, "bob");
    mod = await createUser(admin, "mod");
    adminUser = await createUser(admin, "admin");

    await setRole(admin, alice.id, "user");
    await setRole(admin, bob.id, "user");
    await setRole(admin, mod.id, "moderator");
    await setRole(admin, adminUser.id, "admin");
  });

  afterAll(async () => {
    // Cleanup reports y users.
    if (createdReportIds.length > 0) {
      await admin.from("reports").delete().in("id", createdReportIds);
    }
    await admin.from("user_bans").delete().in("user_id", [alice.id, bob.id, mod.id, adminUser.id]);
    for (const u of [alice, bob, mod, adminUser]) {
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  test("authenticated user can create a report on a product", async () => {
    const { data, error } = await alice.client
      .from("reports")
      .insert({
        target_type: "product",
        target_id: TEST_PRODUCT_ID,
        reason: "spam",
        details: "spammy listing",
        reporter_id: alice.id,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data?.status).toBe("open");
    if (data?.id) createdReportIds.push(data.id);
  });

  test("cannot insert a duplicate open report on same target", async () => {
    const { error } = await alice.client.from("reports").insert({
      target_type: "product",
      target_id: TEST_PRODUCT_ID,
      reason: "duplicate",
      reporter_id: alice.id,
    });
    // Unique index violation = 23505.
    expect(error?.code).toBe("23505");
  });

  test("reporter sees only their own reports", async () => {
    // Bob crea uno en otro target_id para no chocar.
    const { data: bobReport } = await bob.client
      .from("reports")
      .insert({
        target_type: "product",
        target_id: "00000000-0000-0000-0000-000000000bbb",
        reason: "misleading",
        reporter_id: bob.id,
      })
      .select()
      .single();
    if (bobReport?.id) createdReportIds.push(bobReport.id);

    const { data: aliceList } = await alice.client.from("reports").select("*");
    expect(aliceList?.every((r) => r.reporter_id === alice.id)).toBe(true);
  });

  test("moderator sees all reports", async () => {
    const { data, error } = await mod.client.from("reports").select("id, reporter_id");
    expect(error).toBeNull();
    const reporters = new Set((data ?? []).map((r) => r.reporter_id));
    expect(reporters.has(alice.id)).toBe(true);
    expect(reporters.has(bob.id)).toBe(true);
  });

  test("user cannot insert with someone else's reporter_id", async () => {
    const { error } = await alice.client.from("reports").insert({
      target_type: "product",
      target_id: "00000000-0000-0000-0000-000000000ccc",
      reason: "spam",
      reporter_id: bob.id, // intent: forjar reporter_id.
    });
    expect(error).toBeTruthy();
  });

  test("non-mod cannot read mod_actions", async () => {
    const { data } = await alice.client.from("mod_actions").select("id");
    expect(data?.length ?? 0).toBe(0);
  });

  test("admin can ban a user via RPC and is_user_banned returns true", async () => {
    const { data: banId, error } = await adminUser.client.rpc("admin_ban_user", {
      p_user_id: bob.id,
      p_reason: "test ban",
    });
    expect(error).toBeNull();
    expect(banId).toBeTruthy();

    // Helper directo en service-role para consultar.
    const { data: bannedCheck } = await admin.rpc("is_user_banned", { p_user_id: bob.id });
    expect(bannedCheck).toBe(true);

    // Bob ahora no puede crear reports.
    const { error: reportError } = await bob.client.from("reports").insert({
      target_type: "product",
      target_id: "00000000-0000-0000-0000-000000000ddd",
      reason: "spam",
      reporter_id: bob.id,
    });
    expect(reportError).toBeTruthy();
  });

  test("non-admin cannot call admin_ban_user", async () => {
    const { error } = await mod.client.rpc("admin_ban_user", {
      p_user_id: alice.id,
      p_reason: "should fail",
    });
    expect(error).toBeTruthy();
  });

  test("admin can unban", async () => {
    const { error } = await adminUser.client.rpc("admin_unban_user", { p_user_id: bob.id });
    expect(error).toBeNull();

    const { data: bannedCheck } = await admin.rpc("is_user_banned", { p_user_id: bob.id });
    expect(bannedCheck).toBe(false);
  });
});
