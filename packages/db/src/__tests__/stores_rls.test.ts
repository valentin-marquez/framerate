/**
 * Tests RLS para Fase 1: store_members, store_claim_requests, is_store_member().
 *
 * Patrón: 4 clientes (anon, user, mod, admin) + 1 cliente extra que es "owner
 * de store X". Requiere instancia local de Supabase corriendo en 127.0.0.1:54321
 * con las migraciones de Fase 0 y Fase 1 aplicadas.
 *
 * Estos tests SE SALTAN automáticamente si la instancia local no está disponible
 * o si las tablas no existen (i.e. la migración no se aplicó).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
// Default local keys (estables en supabase local). Override con env si cambian.
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsImtpZCI6InN1cGFiYXNlLWRlbW8iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let available = false;
let storeId = "";
const users: Record<string, { id: string; email: string; client: SupabaseClient }> = {};

async function signUp(admin: SupabaseClient, email: string) {
  const password = "test-password-1234";
  // Crear usuario via admin API
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error("createUser failed");
  // Cliente con sesión iniciada
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: created.user.id, email, client };
}

beforeAll(async () => {
  if (!SERVICE_ROLE_KEY) {
    console.log("[stores_rls.test] SUPABASE_SERVICE_ROLE_KEY no definido — skip");
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Probe: ¿existen las tablas de Fase 1?
  const probe = await admin.from("store_members").select("id").limit(1);
  if (probe.error) {
    console.log(`[stores_rls.test] tablas Fase 1 no presentes (${probe.error.message}) — skip`);
    return;
  }

  // Crear o reutilizar una store de prueba
  const slug = `rls-test-store-${Date.now()}`;
  const { data: insertedStore, error: storeErr } = await admin
    .from("stores")
    .insert({ name: slug, slug, url: `https://${slug}.test` })
    .select()
    .single();
  if (storeErr) {
    console.log(`[stores_rls.test] no se pudo crear store: ${storeErr.message} — skip`);
    return;
  }
  storeId = insertedStore.id;

  // 5 usuarios: anon (sin client login), user, mod, admin, owner
  // El cliente "anon" es uno sin sesión.
  users.anon = { id: "", email: "", client: createClient(SUPABASE_URL, ANON_KEY) };
  users.user = await signUp(admin, `user-${Date.now()}@test.local`);
  users.mod = await signUp(admin, `mod-${Date.now()}@test.local`);
  users.admin = await signUp(admin, `admin-${Date.now()}@test.local`);
  users.owner = await signUp(admin, `owner-${Date.now()}@test.local`);

  // Asignar roles globales
  await admin.from("user_roles").insert([
    { user_id: users.mod.id, role: "moderator" },
    { user_id: users.admin.id, role: "admin" },
  ]);
  // Bootstrap owner como miembro 'owner' de la store
  await admin.from("store_members").insert({
    store_id: storeId,
    user_id: users.owner.id,
    role: "owner",
  });

  // Refrescar sesiones para que los JWT incluyan el claim user_role
  for (const k of ["mod", "admin", "owner"] as const) {
    await users[k].client.auth.refreshSession();
  }

  available = true;
});

afterAll(async () => {
  if (!available || !SERVICE_ROLE_KEY) return;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  await admin.from("store_claim_requests").delete().eq("claimed_domain", "rls-test-domain.cl");
  await admin.from("store_members").delete().eq("store_id", storeId);
  await admin.from("stores").delete().eq("id", storeId);
  for (const k of ["user", "mod", "admin", "owner"] as const) {
    if (users[k]?.id) await admin.auth.admin.deleteUser(users[k].id);
  }
});

describe("store_members RLS", () => {
  test("public select: anon puede leer", async () => {
    if (!available) return;
    const { data, error } = await users.anon.client.from("store_members").select("id").eq("store_id", storeId);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test("insert: user normal NO puede agregarse a sí mismo", async () => {
    if (!available) return;
    const { error } = await users.user.client
      .from("store_members")
      .insert({ store_id: storeId, user_id: users.user.id, role: "editor" });
    expect(error).not.toBeNull();
  });

  test("insert: owner SÍ puede agregar editor", async () => {
    if (!available) return;
    const { error } = await users.owner.client
      .from("store_members")
      .insert({ store_id: storeId, user_id: users.user.id, role: "editor" });
    expect(error).toBeNull();
  });

  test("delete: editor (no owner) NO puede remover miembros", async () => {
    if (!available) return;
    const { error } = await users.user.client.from("store_members").delete().eq("store_id", storeId);
    // Sin error pero 0 filas afectadas, o error directo según versión de PostgREST.
    // Verificamos contando: el row sigue ahí.
    const after = await users.anon.client.from("store_members").select("id").eq("store_id", storeId);
    expect((after.data ?? []).length).toBeGreaterThan(0);
    // Si hubo error explícito, vale también
    if (error) expect(error).not.toBeNull();
  });

  test("delete: admin global SÍ puede", async () => {
    if (!available) return;
    const { error } = await users.admin.client
      .from("store_members")
      .delete()
      .eq("store_id", storeId)
      .eq("user_id", users.user.id);
    expect(error).toBeNull();
  });
});

describe("is_store_member RPC", () => {
  test("returns true para owner sobre su store", async () => {
    if (!available) return;
    const { data, error } = await users.owner.client.rpc("is_store_member", {
      p_store_id: storeId,
      p_required_role: "owner",
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });
  test("returns false para user no miembro", async () => {
    if (!available) return;
    const { data, error } = await users.user.client.rpc("is_store_member", {
      p_store_id: storeId,
      p_required_role: "editor",
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
  test("returns false para anon", async () => {
    if (!available) return;
    const { data } = await users.anon.client.rpc("is_store_member", {
      p_store_id: storeId,
      p_required_role: "editor",
    });
    expect(data).toBe(false);
  });
});

describe("store_claim_requests RLS", () => {
  test("user puede crear su propio claim", async () => {
    if (!available) return;
    const { data, error } = await users.user.client
      .from("store_claim_requests")
      .insert({
        store_id: storeId,
        claimed_domain: "rls-test-domain.cl",
        claimant_user_id: users.user.id,
        verification_token: `v1:${Date.now().toString(16).padStart(32, "0")}`,
        txt_record_name: "_framerate-verify.rls-test-domain.cl",
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("pending");
  });

  test("user NO puede crear claim a nombre de otro", async () => {
    if (!available) return;
    const { error } = await users.user.client.from("store_claim_requests").insert({
      claimed_domain: "spoof.cl",
      claimant_user_id: users.admin.id, // intenta hacerse pasar por admin
      verification_token: `v1:${Date.now().toString(16).padStart(32, "0")}`,
      txt_record_name: "_framerate-verify.spoof.cl",
    });
    expect(error).not.toBeNull();
  });

  test("user NO puede ver claims ajenos", async () => {
    if (!available) return;
    const { data } = await users.mod.client
      .from("store_claim_requests")
      .select("id")
      .eq("claimed_domain", "rls-test-domain.cl");
    expect(data ?? []).toHaveLength(0);
  });

  test("admin puede ver todos los claims", async () => {
    if (!available) return;
    const { data, error } = await users.admin.client
      .from("store_claim_requests")
      .select("id")
      .eq("claimed_domain", "rls-test-domain.cl");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
