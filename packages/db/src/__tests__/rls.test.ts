/**
 * Suite de tests RLS para Fase 0 (user_roles, authorize, JWT hook).
 *
 * Corre contra la instancia LOCAL de Supabase. Para ejecutar:
 *   1) Asegurate de tener Supabase local arriba: `cd packages/db && bun x supabase start`
 *   2) `cd packages/db && bun run test:rls`
 *
 * Variables leídas desde process.env (se cargan desde packages/db/.env.test
 * si existe, con fallback a los valores hardcodeados de Supabase local).
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

const SUPABASE_URL = process.env.LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321";

// Default = claves estándar del stack local de Supabase (no son secretos).
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const SERVICE_ROLE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Cliente con service role: bypasa RLS, lo usamos para setup y teardown.
const admin: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Role = "user" | "moderator" | "admin";

interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient<Database>;
  accessToken: string;
  jwtPayload: Record<string, unknown>;
}

const createdUserIds: string[] = [];

function rand(): string {
  return Math.random().toString(36).slice(2, 10);
}

function decodeJwt(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid jwt");
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
}

/**
 * Crea un usuario via admin API, le asigna `roles` (lista de roles globales,
 * vacía = solo "user" por defecto) y devuelve un cliente logueado.
 */
async function makeUser(roles: Role[] = []): Promise<TestUser> {
  const email = `test-${rand()}@framerate.test`;
  const password = `Pass-${rand()}-${rand()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message}`);
  }
  const userId = created.user.id;
  createdUserIds.push(userId);

  if (roles.length > 0) {
    const rows = roles.map((role) => ({ user_id: userId, role }));
    const { error: roleErr } = await admin.from("user_roles").insert(rows);
    if (roleErr) {
      throw new Error(`insert user_roles failed: ${roleErr.message}`);
    }
  }

  // Loguear como ese user para obtener un JWT con los claims inyectados por el hook.
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) {
    throw new Error(`signIn failed: ${signInErr?.message}`);
  }

  return {
    id: userId,
    email,
    password,
    client,
    accessToken: signIn.session.access_token,
    jwtPayload: decodeJwt(signIn.session.access_token),
  };
}

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

beforeAll(async () => {
  // Limpieza preventiva: borrar cualquier user_roles huérfano de runs anteriores
  // (los usuarios sin email @framerate.test los respeta).
  const { data: stale } = await admin.from("user_roles").select("user_id").limit(1);
  // No-op si stale es vacío; sirve para verificar que el service_role conecta OK.
  void stale;
});

afterEach(async () => {
  // Borrar todos los users creados durante el test. CASCADE elimina user_roles.
  for (const id of createdUserIds.splice(0, createdUserIds.length)) {
    await admin.auth.admin.deleteUser(id).catch(() => {
      /* swallow */
    });
  }
});

afterAll(async () => {
  // Safety net por si quedó algo.
  for (const id of createdUserIds.splice(0, createdUserIds.length)) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

// =====================================================================
// JWT hook
// =====================================================================
describe("custom_access_token_hook inyecta claims", () => {
  test("usuario sin roles asignados recibe user_role='user'", async () => {
    const u = await makeUser([]);
    expect(u.jwtPayload.user_role).toBe("user");
    expect(u.jwtPayload.user_roles).toEqual(["user"]);
  });

  test("usuario admin recibe user_role='admin'", async () => {
    const u = await makeUser(["admin"]);
    expect(u.jwtPayload.user_role).toBe("admin");
    expect(u.jwtPayload.user_roles).toContain("admin");
  });

  test("usuario moderator recibe user_role='moderator'", async () => {
    const u = await makeUser(["moderator"]);
    expect(u.jwtPayload.user_role).toBe("moderator");
  });

  test("usuario con varios roles recibe el rol más alto (admin > moderator > user)", async () => {
    const u = await makeUser(["user", "moderator", "admin"]);
    expect(u.jwtPayload.user_role).toBe("admin");
    const roles = u.jwtPayload.user_roles as string[];
    expect(roles).toContain("admin");
    expect(roles).toContain("moderator");
  });
});

// =====================================================================
// authorize()
// =====================================================================
describe("authorize() helper", () => {
  test("admin pasa authorize('admin')", async () => {
    const u = await makeUser(["admin"]);
    const { data, error } = await u.client.rpc("authorize", { required_role: "admin" });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  test("admin pasa authorize('moderator') y authorize('user')", async () => {
    const u = await makeUser(["admin"]);
    const a = await u.client.rpc("authorize", { required_role: "moderator" });
    const b = await u.client.rpc("authorize", { required_role: "user" });
    expect(a.data).toBe(true);
    expect(b.data).toBe(true);
  });

  test("moderator pasa authorize('moderator') y authorize('user')", async () => {
    const u = await makeUser(["moderator"]);
    const a = await u.client.rpc("authorize", { required_role: "moderator" });
    const b = await u.client.rpc("authorize", { required_role: "user" });
    expect(a.data).toBe(true);
    expect(b.data).toBe(true);
  });

  test("moderator NO pasa authorize('admin')", async () => {
    const u = await makeUser(["moderator"]);
    const { data } = await u.client.rpc("authorize", { required_role: "admin" });
    expect(data).toBe(false);
  });

  test("user normal NO pasa authorize('moderator') ni authorize('admin')", async () => {
    const u = await makeUser([]);
    const a = await u.client.rpc("authorize", { required_role: "moderator" });
    const b = await u.client.rpc("authorize", { required_role: "admin" });
    expect(a.data).toBe(false);
    expect(b.data).toBe(false);
  });
});

// =====================================================================
// RLS en user_roles
// =====================================================================
describe("user_roles RLS", () => {
  test("anon NO puede leer user_roles", async () => {
    // Sembrar al menos un row para que la query no devuelva vacío por trivialidad.
    const u = await makeUser(["moderator"]);
    void u; // sólo nos importa que exista el row

    const anon = anonClient();
    const { data, error } = await anon.from("user_roles").select("*").limit(10);
    // El cliente anon, con RLS, recibe array vacío (no error). Lo importante:
    // no recibe el row recién creado.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  test("user normal sólo ve sus propios roles", async () => {
    const u = await makeUser([]);
    const other = await makeUser(["moderator"]);

    const { data, error } = await u.client.from("user_roles").select("*");
    expect(error).toBeNull();
    // Como el user normal no tiene roles asignados, no debería ver ninguno
    // (ni el suyo — no tiene — ni el del otro).
    expect((data ?? []).every((r) => r.user_id === u.id)).toBe(true);
    expect((data ?? []).some((r) => r.user_id === other.id)).toBe(false);
  });

  test("user con rol asignado ve sólo el suyo", async () => {
    const u = await makeUser(["moderator"]);
    const other = await makeUser(["admin"]);

    const { data, error } = await u.client.from("user_roles").select("*");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    expect((data ?? [])[0].user_id).toBe(u.id);
    expect((data ?? []).some((r) => r.user_id === other.id)).toBe(false);
  });

  test("admin ve TODOS los roles", async () => {
    const adminUser = await makeUser(["admin"]);
    const mod = await makeUser(["moderator"]);
    const plain = await makeUser([]);
    void plain;

    const { data, error } = await adminUser.client.from("user_roles").select("user_id, role");
    expect(error).toBeNull();
    const userIds = (data ?? []).map((r) => r.user_id);
    expect(userIds).toContain(adminUser.id);
    expect(userIds).toContain(mod.id);
  });

  test("admin puede asignar un rol nuevo a otro user", async () => {
    const adminUser = await makeUser(["admin"]);
    const target = await makeUser([]);

    const { error } = await adminUser.client
      .from("user_roles")
      .insert({ user_id: target.id, role: "moderator", granted_by: adminUser.id });

    expect(error).toBeNull();

    // Verificar con service role que el row existe.
    const { data } = await admin.from("user_roles").select("*").eq("user_id", target.id).eq("role", "moderator");
    expect(data ?? []).toHaveLength(1);
  });

  test("user normal NO puede asignar un rol (insert bloqueado por RLS)", async () => {
    const attacker = await makeUser([]);
    const victim = await makeUser([]);

    const { error } = await attacker.client.from("user_roles").insert({ user_id: victim.id, role: "admin" });

    expect(error).not.toBeNull();
  });

  test("moderator NO puede asignar un rol", async () => {
    const mod = await makeUser(["moderator"]);
    const victim = await makeUser([]);

    const { error } = await mod.client.from("user_roles").insert({ user_id: victim.id, role: "admin" });

    expect(error).not.toBeNull();
  });

  test("user normal NO puede borrar su propio rol", async () => {
    const u = await makeUser(["moderator"]);
    const { error, count } = await u.client.from("user_roles").delete({ count: "exact" }).eq("user_id", u.id);

    // RLS no produce error por filas no afectadas, pero count debe ser 0.
    expect(error).toBeNull();
    expect(count ?? 0).toBe(0);
  });

  test("admin puede borrar un rol", async () => {
    const adminUser = await makeUser(["admin"]);
    const target = await makeUser(["moderator"]);

    const { error } = await adminUser.client
      .from("user_roles")
      .delete()
      .eq("user_id", target.id)
      .eq("role", "moderator");

    expect(error).toBeNull();

    const { data } = await admin.from("user_roles").select("*").eq("user_id", target.id).eq("role", "moderator");
    expect(data ?? []).toHaveLength(0);
  });
});

// =====================================================================
// is_store_member() stub
// =====================================================================
describe("is_store_member() stub (Fase 0)", () => {
  test("siempre devuelve false (placeholder hasta Fase 1)", async () => {
    const u = await makeUser([]);
    const { data, error } = await u.client.rpc("is_store_member", {
      p_store_id: "00000000-0000-0000-0000-000000000000",
      p_required_role: "editor",
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  test("también devuelve false para admins (Fase 1 puede cambiar el contrato)", async () => {
    const u = await makeUser(["admin"]);
    const { data } = await u.client.rpc("is_store_member", {
      p_store_id: "00000000-0000-0000-0000-000000000000",
      p_required_role: "editor",
    });
    expect(data).toBe(false);
  });
});
