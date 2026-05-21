import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { detectDnsProvider } from "@/lib/dns-provider";
import { verifyTxtRecord } from "@/lib/doh";
import { generateToken, normalizeDomain, txtRecordName, txtRecordValue } from "@/lib/domain";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";
import { Limit } from "@/middleware/rate-limit";

const logger = new Logger("Claims");

const claims = new Hono<{ Bindings: Bindings; Variables: Variables }>();

claims.use("*", authMiddleware);

/**
 * POST /v1/claims
 * body: { domain: string, store_id?: uuid }
 *
 * Crea un claim pending y devuelve las instrucciones de TXT.
 */
claims.post("/", Limit("strict"), async (c) => {
  const user = c.get("user");
  const token = c.get("token");

  const body = await c.req.json<{ domain?: string; store_id?: string }>().catch(() => null);
  if (!body || (typeof body.store_id !== "string" && typeof body.domain !== "string")) {
    return c.json({ error: "Body { store_id: uuid } o { domain: string } requerido" }, 400);
  }

  const supabase = createSupabase(c.env, token);

  // Camino preferido: el usuario elige una tienda del catálogo y el dominio se
  // deriva de `stores.url` (lo que realmente se verifica por DNS). El usuario
  // nunca tipea dominio ni pega un UUID.
  let storeId: string | null = null;
  let domain: string | null = null;

  if (body.store_id) {
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, url")
      .eq("id", body.store_id)
      .maybeSingle();
    if (error || !store) {
      return c.json({ error: "Tienda no encontrada" }, 404);
    }
    domain = store.url ? normalizeDomain(store.url) : null;
    if (!domain) {
      return c.json({ error: "Esta tienda no tiene un dominio válido para verificar" }, 400);
    }
    storeId = store.id;
  } else if (typeof body.domain === "string") {
    // Compat de API: claim por dominio libre (la UI no expone este camino).
    domain = normalizeDomain(body.domain);
    if (!domain) {
      return c.json({ error: "Dominio inválido" }, 400);
    }
  }

  if (!domain) {
    return c.json({ error: "No se pudo determinar el dominio a verificar" }, 400);
  }

  const verificationToken = generateToken();
  const txtName = txtRecordName(domain);
  const txtValue = txtRecordValue(verificationToken);

  // Detección best-effort del provider DNS. Si falla DoH o no matchea nada,
  // dejamos null y la UI cae a las instrucciones genéricas. Nunca bloquea
  // la creación del claim.
  const detected = await detectDnsProvider(domain).catch((err: unknown) => {
    logger.warn(`detectDnsProvider failed for ${domain}: ${err instanceof Error ? err.message : err}`);
    return { provider: null, nameservers: [] as string[] };
  });

  // biome-ignore lint/suspicious/noExplicitAny: types se regeneran tras migration up
  const { data: inserted, error: insertErr } = await (supabase as any)
    .from("store_claim_requests")
    .insert({
      store_id: storeId,
      claimed_domain: domain,
      claimant_user_id: user.id,
      verification_token: verificationToken,
      txt_record_name: txtName,
      dns_provider: detected.provider?.id ?? null,
      dns_nameservers: detected.nameservers.length > 0 ? detected.nameservers : null,
    })
    .select()
    .single();

  if (insertErr) {
    logger.error(`Insert claim failed: ${insertErr.message}`);
    // Constraint único activo -> ya hay un claim pending/verified.
    if (insertErr.code === "23505") {
      return c.json({ error: "Ya existe un reclamo activo para este dominio" }, 409);
    }
    return c.json({ error: "No se pudo crear el reclamo" }, 500);
  }

  logger.info(
    `Claim creado para ${domain}: provider=${detected.provider?.id ?? "unknown"} ns=${detected.nameservers.join(",") || "-"}`,
  );

  return c.json(
    {
      id: inserted.id,
      domain,
      txt_name: txtName,
      txt_value: txtValue,
      status: inserted.status,
      expires_at: inserted.expires_at,
      dns_provider: detected.provider?.id ?? null,
      dns_nameservers: detected.nameservers,
      instructions: {
        es: `Agregá un registro TXT en tu DNS:\n  Nombre: ${txtName}\n  Valor: ${txtValue}\nLuego POSTeá a /v1/claims/${inserted.id}/verify.`,
        en: `Add a TXT record to your DNS:\n  Name: ${txtName}\n  Value: ${txtValue}\nThen POST to /v1/claims/${inserted.id}/verify.`,
      },
    },
    201,
  );
});

/**
 * POST /v1/claims/:id/verify
 *
 * Hace DoH paralelo contra Cloudflare + Google, requiere match en ambos.
 * Actualiza el claim a 'verified' si pasa, o registra el intento si no.
 */
claims.post("/:id/verify", Limit("strict"), async (c) => {
  const user = c.get("user");
  const token = c.get("token");
  const claimId = c.req.param("id");

  const supabase = createSupabase(c.env, token);

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data: claim, error: fetchErr } = await (supabase as any)
    .from("store_claim_requests")
    .select("*")
    .eq("id", claimId)
    .maybeSingle();

  if (fetchErr || !claim) {
    return c.json({ error: "Claim no encontrado" }, 404);
  }

  if (claim.claimant_user_id !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (claim.status === "verified") {
    return c.json({ id: claim.id, status: "verified", verified_at: claim.verified_at });
  }

  if (claim.status !== "pending") {
    return c.json({ error: `Claim is ${claim.status}` }, 400);
  }

  if (new Date(claim.expires_at).getTime() < Date.now()) {
    // biome-ignore lint/suspicious/noExplicitAny: types regen
    await (supabase as any).from("store_claim_requests").update({ status: "expired" }).eq("id", claimId);
    return c.json({ error: "Claim expired" }, 410);
  }

  const expectedValue = txtRecordValue(claim.verification_token);
  const result = await verifyTxtRecord(claim.txt_record_name, expectedValue);

  // RPC SECURITY DEFINER que valida auth.uid() = claimant_user_id antes del
  // update — sortea la policy que sólo permite service_role en updates directos
  // preservando la trust boundary (api sigue corriendo con anon + JWT user).
  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data: rpcRow, error: updateErr } = await (supabase as any).rpc("record_claim_verification_attempt", {
    p_claim_id: claimId,
    p_matched: result.matched,
    p_dns_details: result.details
      ? JSON.parse(JSON.stringify({ status: result.status, details: result.details }))
      : null,
  });

  if (updateErr) {
    logger.warn(`record_claim_verification_attempt failed: ${updateErr.message}`);
    const msg = updateErr.message ?? "";
    if (msg.includes("unauthorized")) return c.json({ error: "Forbidden" }, 403);
    if (msg.includes("not found")) return c.json({ error: "Claim no encontrado" }, 404);
    if (msg.includes("expired")) return c.json({ error: "Claim expired" }, 410);
    return c.json({ error: msg || "Verify failed" }, 500);
  }

  const updated = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
  return c.json({
    id: updated?.id ?? claimId,
    status: updated?.status ?? (result.matched ? "verified" : "pending"),
    matched: result.matched,
    attempts: updated?.attempts,
    dns: result.details,
  });
});

/**
 * POST /v1/claims/:id/confirm
 *
 * Llama al RPC confirm_store_claim que atómicamente crea store_members(owner)
 * y actualiza stores.owner_user_id + verified_at. Requiere status='verified'.
 */
claims.post("/:id/confirm", Limit("strict"), async (c) => {
  const token = c.get("token");
  const claimId = c.req.param("id");
  const supabase = createSupabase(c.env, token);

  // biome-ignore lint/suspicious/noExplicitAny: RPC types regen
  const { data, error } = await (supabase as any).rpc("confirm_store_claim", { p_claim_id: claimId });

  if (error) {
    logger.warn(`confirm_store_claim failed: ${error.message}`);
    const msg = error.message ?? "Confirm failed";
    if (msg.includes("not verified")) return c.json({ error: msg }, 400);
    if (msg.includes("unauthorized")) return c.json({ error: "Forbidden" }, 403);
    if (msg.includes("not found")) return c.json({ error: "Claim no encontrado" }, 404);
    if (msg.includes("expired")) return c.json({ error: "Claim expired" }, 410);
    if (msg.includes("no associated store")) return c.json({ error: msg }, 422);
    return c.json({ error: "No se pudo confirmar" }, 500);
  }

  return c.json({ store: data });
});

/**
 * GET /v1/claims/my
 *
 * Lista los claims del usuario autenticado.
 */
claims.get("/my", Limit("lenient"), async (c) => {
  const user = c.get("user");
  const token = c.get("token");
  const supabase = createSupabase(c.env, token);

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data, error } = await (supabase as any)
    .from("store_claim_requests")
    .select(
      "id, store_id, claimed_domain, txt_record_name, verification_token, status, attempts, last_checked_at, verified_at, expires_at, created_at, dns_provider, dns_nameservers",
    )
    .eq("claimant_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error(`List my claims: ${error.message}`);
    return c.json({ error: "No se pudieron listar reclamos" }, 500);
  }

  // Exponemos el valor TXT calculado (no el token crudo) para que el front
  // pueda volver a mostrar las instrucciones al retomar un claim pendiente.
  const claims = (data ?? []).map((row: { verification_token: string; [k: string]: unknown }) => {
    const { verification_token, ...rest } = row;
    return { ...rest, txt_record_value: txtRecordValue(verification_token) };
  });

  return c.json({ claims });
});

/**
 * GET /v1/claims/:id/dns-check
 *
 * "Peek" read-only: hace el lookup DoH y reporta si el TXT ya está, sin tocar
 * la DB. NO llama al RPC record_claim_verification_attempt — por eso no gatilla
 * el cooldown de 60s ni el cap de 50 intentos. El front lo pollea seguido para
 * detección rápida; el commit real (POST /verify) corre una sola vez al match.
 */
claims.get("/:id/dns-check", Limit("moderate"), async (c) => {
  const user = c.get("user");
  const token = c.get("token");
  const claimId = c.req.param("id");
  const supabase = createSupabase(c.env, token);

  // biome-ignore lint/suspicious/noExplicitAny: types regen
  const { data: claim, error } = await (supabase as any)
    .from("store_claim_requests")
    .select("id, txt_record_name, verification_token, status, claimant_user_id")
    .eq("id", claimId)
    .maybeSingle();

  if (error || !claim) {
    return c.json({ error: "Claim no encontrado" }, 404);
  }
  if (claim.claimant_user_id !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const expected = txtRecordValue(claim.verification_token);

  // Ya verificado: no hace falta DoH.
  if (claim.status === "verified") {
    return c.json({ matched: true, status: "verified", expected, found: [] });
  }

  const result = await verifyTxtRecord(claim.txt_record_name, expected);
  const found = Array.from(new Set([...result.details.cloudflare.records, ...result.details.google.records]));

  return c.json({ matched: result.matched, status: result.status, expected, found });
});

export default claims;
