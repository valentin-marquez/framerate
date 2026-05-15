/**
 * Tests del flujo end-to-end de moderacion contra Supabase local.
 *
 * No invocamos los handlers HTTP de Hono — testeamos las RPCs y RLS
 * usando supabase-js (que es lo que los handlers efectivamente llaman).
 * Esto cubre el contrato de las funciones SQL que la API expone.
 *
 *   bun test apps/api/src/routes/__tests__/moderation.test.ts
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

const maybeDescribe = isLocalUp ? describe : describe.skip;

interface Ctx {
  id: string;
  client: SupabaseClient<Database>;
}

async function createUser(admin: SupabaseClient<Database>, suffix: string): Promise<Ctx> {
  const email = `phase4api-${suffix}-${Date.now()}@framerate.test`;
  const password = "phase4-api-test-pw-1234";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY);
  const { error: e } = await client.auth.signInWithPassword({ email, password });
  if (e) throw new Error(e.message);
  return { id: data.user.id, client };
}

maybeDescribe("moderation flow", () => {
  let admin: SupabaseClient<Database>;
  let alice: Ctx; // reporter
  let mod: Ctx;
  let productId: string;
  const cleanupIds: string[] = [];

  beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    alice = await createUser(admin, "alice");
    mod = await createUser(admin, "mod");

    await admin.from("user_roles").upsert([
      { user_id: alice.id, role: "user" },
      { user_id: mod.id, role: "moderator" },
    ]);

    // Reusamos brand y category existentes (cualquiera sirve para el fixture).
    const { data: anyBrand } = await admin.from("brands").select("id").limit(1).single();
    const { data: anyCategory } = await admin.from("categories").select("id").limit(1).single();
    if (!anyBrand || !anyCategory) {
      throw new Error("DB local sin brands o categories — corre el dump de prod-data antes de testear");
    }

    const { data: product, error: productError } = await admin
      .from("products")
      .insert({
        name: `Phase4 test product ${Date.now()}`,
        slug: `phase4-product-${Date.now()}`,
        brand_id: anyBrand.id,
        category_id: anyCategory.id,
      })
      .select()
      .single();

    if (productError || !product) throw new Error(`product fixture failed: ${productError?.message}`);
    productId = product.id;
  });

  afterAll(async () => {
    // Clean reports + products.
    if (cleanupIds.length > 0) {
      await admin.from("reports").delete().in("id", cleanupIds);
    }
    await admin.from("product_recheck_queue").delete().eq("product_id", productId);
    await admin.from("products").delete().eq("id", productId);
    await admin.auth.admin.deleteUser(alice.id);
    await admin.auth.admin.deleteUser(mod.id);
  });

  test("user creates a report -> queue enqueues -> mod resolves -> audit row exists", async () => {
    // 1. Crear report.
    const { data: report, error: reportError } = await alice.client
      .from("reports")
      .insert({
        target_type: "product",
        target_id: productId,
        reason: "wrong_listing",
        details: "duplicate listing",
        reporter_id: alice.id,
      })
      .select()
      .single();
    expect(reportError).toBeNull();
    expect(report).toBeTruthy();
    if (!report) return;
    cleanupIds.push(report.id);

    // 2. Como otros suites pueden dejar items obsoletos, vamos drenando.
    // get_next_mod_item auto-archiva mensajes huerfanos (report deleted),
    // asi que iteramos hasta encontrar nuestro report o agotar el cap.
    type QueueItem = { msg_id: number; report_id: string; target_type: string; target_id: string };

    let item: QueueItem | null = null;
    let consecutiveEmpty = 0;
    for (let attempt = 0; attempt < 30 && item === null; attempt++) {
      const { data: queueData } = await mod.client.rpc("get_next_mod_item");
      const candidate = Array.isArray(queueData) ? (queueData[0] as QueueItem | undefined) : undefined;
      if (!candidate) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 3) break; // realmente vacio
        continue;
      }
      consecutiveEmpty = 0;
      if (candidate.report_id === report.id) {
        item = candidate;
        break;
      }
      // Descartamos via resolve (mod) -> archiva.
      await mod.client.rpc("resolve_mod_report", {
        p_msg_id: candidate.msg_id,
        p_report_id: candidate.report_id,
        p_decision: "dismissed",
        p_note: "test drain",
      });
    }
    expect(item).toBeTruthy();
    if (!item) return;
    expect(item.report_id).toBe(report.id);
    expect(item.target_type).toBe("product");
    expect(item.target_id).toBe(productId);

    // 3. Mod resuelve.
    const { error: resolveError } = await mod.client.rpc("resolve_mod_report", {
      p_msg_id: item.msg_id,
      p_report_id: item.report_id,
      p_decision: "resolved",
      p_note: "Listing corregido manualmente",
    });
    expect(resolveError).toBeNull();

    // 4. Verificar que report quedo resuelto.
    const { data: refreshed } = await mod.client
      .from("reports")
      .select("status, resolution_note")
      .eq("id", report.id)
      .single();
    expect(refreshed?.status).toBe("resolved");
    expect(refreshed?.resolution_note).toBe("Listing corregido manualmente");

    // 5. mod_actions debe tener una entrada con action='resolve_report'.
    const { data: actions } = await mod.client
      .from("mod_actions")
      .select("action, target_id")
      .eq("target_id", report.id)
      .order("created_at", { ascending: false });
    expect(actions?.length ?? 0).toBeGreaterThan(0);
    expect(actions?.[0]?.action).toBe("resolve_report");
  });

  test("non-moderator cannot call get_next_mod_item", async () => {
    const { error } = await alice.client.rpc("get_next_mod_item");
    expect(error).toBeTruthy();
  });

  test("flag_product_for_recheck inserts row and writes audit", async () => {
    const { data: recheckId, error } = await mod.client.rpc("flag_product_for_recheck", {
      p_product_id: productId,
      p_reason: "stock parece mal",
    });
    expect(error).toBeNull();
    expect(recheckId).toBeTruthy();

    const { data: recheck } = await admin
      .from("product_recheck_queue")
      .select("product_id, status, reason")
      .eq("product_id", productId)
      .single();
    expect(recheck?.status).toBe("pending");
    expect(recheck?.reason).toBe("stock parece mal");

    const { data: actions } = await mod.client
      .from("mod_actions")
      .select("action")
      .eq("target_id", productId)
      .eq("action", "flag_product_for_recheck");
    expect(actions?.length ?? 0).toBeGreaterThan(0);
  });
});
