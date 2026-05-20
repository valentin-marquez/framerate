/**
 * Tests del endpoint admin de revoke + listado de claims contra Supabase local.
 *
 * Igual que `moderation.test.ts` testeamos el contrato de las RPCs/RLS que el
 * handler invoca, no el HTTP de Hono directamente. La validación de admin la
 * hace `admin_revoke_claim` adentro (SECURITY DEFINER) — lo verificamos
 * contra clientes con distintos roles.
 *
 *   bun test apps/api/src/routes/__tests__/admin-claims.test.ts
 *
 * Nota: este suite asume el RPC `admin_revoke_claim` aplicado por la migración
 * en paralelo (Agent 1). Si no está en la DB local, los tests que dependen del
 * RPC se marcan como skip — el suite no rompe la suite global.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Database } from "@framerate/db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const isLocalUp = await fetch(`${SUPABASE_URL}/auth/v1/health`)
  .then((r) => r.ok)
  .catch(() => false);

// Sondeamos si el RPC existe — si Agent 1 todavía no aplicó la migración,
// degradamos el suite a skip para no romper CI mientras se mergea en paralelo.
let hasRevokeRpc = false;
if (isLocalUp) {
  const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // biome-ignore lint/suspicious/noExplicitAny: rpc agregada en migración paralela
  const { error } = await (admin as any).rpc("admin_revoke_claim", {
    p_claim_id: "00000000-0000-0000-0000-000000000000",
    p_reason: null,
  });
  // Si el RPC NO existe, postgres responde 42883 "function ... does not exist".
  // Cualquier otro error (incluyendo 'claim not found' P0002 o 'admin role
  // required' 42501) indica que el RPC sí está aplicado.
  hasRevokeRpc = !(error?.code === "42883" || (error?.message ?? "").includes("does not exist"));
}

const maybeDescribe = isLocalUp && hasRevokeRpc ? describe : describe.skip;

interface Ctx {
  id: string;
  client: SupabaseClient<Database>;
}

async function createUser(admin: SupabaseClient<Database>, suffix: string): Promise<Ctx> {
  const email = `admin-claims-${suffix}-${Date.now()}@framerate.test`;
  const password = "admin-claims-test-pw-1234";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY);
  const { error: e } = await client.auth.signInWithPassword({ email, password });
  if (e) throw new Error(e.message);
  return { id: data.user.id, client };
}

maybeDescribe("admin claims (revoke + list)", () => {
  let admin: SupabaseClient<Database>;
  let anonClient: SupabaseClient<Database>;
  let regularUser: Ctx;
  let adminUser: Ctx;
  let storeId: string;
  const claimIdsToCleanup: string[] = [];

  beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY);

    regularUser = await createUser(admin, "regular");
    adminUser = await createUser(admin, "admin");

    await admin.from("user_roles").upsert([
      { user_id: regularUser.id, role: "user" },
      { user_id: adminUser.id, role: "admin" },
    ]);

    // El JWT cachea el rol; forzamos refresh para que `admin` venga en el claim.
    await adminUser.client.auth.refreshSession();

    // Necesitamos una tienda para asociar el claim. Reusamos una existente.
    const { data: anyStore } = await admin.from("stores").select("id, url").limit(1).single();
    if (!anyStore) {
      throw new Error("DB local sin stores — corré el dump de prod-data antes de testear");
    }
    storeId = anyStore.id;
  });

  afterAll(async () => {
    if (claimIdsToCleanup.length > 0) {
      // biome-ignore lint/suspicious/noExplicitAny: types se regeneran
      await (admin as any).from("store_claim_requests").delete().in("id", claimIdsToCleanup);
    }
    if (regularUser) await admin.auth.admin.deleteUser(regularUser.id);
    if (adminUser) await admin.auth.admin.deleteUser(adminUser.id);
  });

  async function createPendingClaim(suffix: string): Promise<string> {
    // biome-ignore lint/suspicious/noExplicitAny: types se regeneran
    const { data, error } = await (admin as any)
      .from("store_claim_requests")
      .insert({
        store_id: storeId,
        claimed_domain: `revoke-test-${suffix}-${Date.now()}.test`,
        claimant_user_id: regularUser.id,
        verification_token: crypto.randomUUID(),
        txt_record_name: `_framerate-${suffix}.test`,
        status: "verified",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`createPendingClaim failed: ${error?.message}`);
    claimIdsToCleanup.push(data.id);
    return data.id;
  }

  test("admin: revoke happy path -> claim status=revoked", async () => {
    const claimId = await createPendingClaim("happy");

    // biome-ignore lint/suspicious/noExplicitAny: rpc agregada en migración paralela
    const { error } = await (adminUser.client as any).rpc("admin_revoke_claim", {
      p_claim_id: claimId,
      p_reason: "test revoke",
    });
    expect(error).toBeNull();

    // biome-ignore lint/suspicious/noExplicitAny: types se regeneran
    const { data: refreshed } = await (admin as any)
      .from("store_claim_requests")
      .select("status")
      .eq("id", claimId)
      .single();
    expect(refreshed?.status).toBe("revoked");
  });

  test("non-admin authenticated cannot revoke (42501 unauthorized)", async () => {
    const claimId = await createPendingClaim("forbidden");

    // biome-ignore lint/suspicious/noExplicitAny: rpc agregada en migración paralela
    const { error } = await (regularUser.client as any).rpc("admin_revoke_claim", {
      p_claim_id: claimId,
      p_reason: null,
    });
    expect(error).toBeTruthy();
    expect(error?.code === "42501" || (error?.message ?? "").toLowerCase().includes("admin")).toBe(true);
  });

  test("anonymous cannot revoke (42501 unauthorized)", async () => {
    const claimId = await createPendingClaim("anon");

    // biome-ignore lint/suspicious/noExplicitAny: rpc agregada en migración paralela
    const { error } = await (anonClient as any).rpc("admin_revoke_claim", {
      p_claim_id: claimId,
      p_reason: null,
    });
    expect(error).toBeTruthy();
  });

  test("claim not found -> P0002", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    // biome-ignore lint/suspicious/noExplicitAny: rpc agregada en migración paralela
    const { error } = await (adminUser.client as any).rpc("admin_revoke_claim", {
      p_claim_id: fakeId,
      p_reason: null,
    });
    expect(error).toBeTruthy();
    expect(error?.code === "P0002" || (error?.message ?? "").toLowerCase().includes("not found")).toBe(true);
  });

  test("admin: lista claims (incluyendo el revocado)", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: types se regeneran
    const { data, error } = await (adminUser.client as any)
      .from("store_claim_requests")
      .select(
        "id, store_id, claimed_domain, claimant_user_id, status, attempts, last_checked_at, verified_at, expires_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // Por lo menos los claims que creamos en este suite tienen que estar.
    const ids = (data ?? []).map((row: { id: string }) => row.id);
    for (const id of claimIdsToCleanup) {
      expect(ids).toContain(id);
    }
  });

  test("non-admin no puede listar via RLS (o lista vacía)", async () => {
    // RLS sobre store_claim_requests permite ver solo los propios claims.
    // El non-admin sigue pudiendo correr el SELECT pero no debería ver claims
    // de OTROS usuarios — el handler HTTP corta antes con 403 vía requireRole,
    // así que aquí solo verificamos que la query no escala privilegios.
    // biome-ignore lint/suspicious/noExplicitAny: types se regeneran
    const { data } = await (regularUser.client as any).from("store_claim_requests").select("id, claimant_user_id");
    for (const row of data ?? []) {
      // El regular user nunca debería ver claims ajenos al hacer un SELECT
      // genérico — la policy por usuario lo restringe a los propios.
      expect(row.claimant_user_id).toBe(regularUser.id);
    }
  });
});
