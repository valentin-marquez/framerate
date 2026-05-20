import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware, requireRole } from "@/middleware/auth";
import { Limit } from "@/middleware/rate-limit";

const logger = new Logger("AdminClaimsRoute");

const adminClaims = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Todas las rutas requieren JWT válido + rol admin global.
adminClaims.use("*", authMiddleware);
adminClaims.use("*", requireRole("admin"));

const VALID_CLAIM_STATUSES = new Set(["pending", "verified", "failed", "expired", "revoked", "stale"]);

interface RevokeBody {
  reason?: string | null;
}

/**
 * GET /v1/admin/claims?status=&limit=
 *
 * Lista de claims para el dashboard de admin. Acepta filtro por status exacto
 * y limit (default 50, max 100). Hace join a stores para mostrar name/slug.
 *
 * No cacheable: es admin tooling y necesita datos frescos.
 */
adminClaims.get("/", Limit("moderate"), async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const status = c.req.query("status");
    const limitParam = Number(c.req.query("limit") ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 100);

    if (status !== undefined && !VALID_CLAIM_STATUSES.has(status)) {
      return c.json({ error: `status must be one of ${[...VALID_CLAIM_STATUSES].join(", ")}` }, 400);
    }

    // biome-ignore lint/suspicious/noExplicitAny: rpc agregada en migración paralela, types se regeneran post-merge
    let query = (supabase as any)
      .from("store_claim_requests")
      .select(
        "id, store_id, claimed_domain, claimant_user_id, status, attempts, last_checked_at, verified_at, expires_at, created_at, store:stores(name, slug)",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      logger.error(`list admin claims failed: ${error.message}`);
      return c.json({ error: "Failed to fetch claims" }, 500);
    }

    return c.json({ claims: data ?? [] });
  } catch (error) {
    logger.error(`list admin claims error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /v1/admin/claims/:id/revoke
 * body: { reason?: string }
 *
 * Revoca un claim verified/pending. Atómicamente:
 *  - limpia stores.account_id
 *  - borra account_members asociados
 *  - drop store_profiles
 *  - marca claim status='revoked'
 *  - escribe claim_audit_log
 *
 * La validación de admin la hace el RPC `admin_revoke_claim` por dentro
 * (security definer); igual exigimos el middleware para corte temprano.
 */
adminClaims.post("/:id/revoke", Limit("strict"), async (c) => {
  try {
    const claimId = c.req.param("id");
    if (!claimId) {
      return c.json({ error: "claim id required" }, 400);
    }

    const body = await c.req.json<RevokeBody>().catch(() => ({}) as RevokeBody);
    const reason = typeof body?.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;

    const supabase = createSupabase(c.env, c.get("token"));

    // biome-ignore lint/suspicious/noExplicitAny: rpc agregada en migración paralela, types se regeneran post-merge
    const { error } = await (supabase as any).rpc("admin_revoke_claim", {
      p_claim_id: claimId,
      p_reason: reason,
    });

    if (error) {
      const msg = error.message ?? "";
      const code = error.code ?? "";
      logger.warn(`admin_revoke_claim failed (code=${code}): ${msg}`);

      // Errores conocidos del RPC (ver contrato):
      //   42501 'unauthorized' o 'admin role required' -> 401/403
      //   P0002 'claim not found' -> 404
      if (code === "42501" || msg.includes("unauthorized")) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      if (msg.includes("admin role required")) {
        return c.json({ error: "Forbidden" }, 403);
      }
      if (code === "P0002" || msg.includes("not found")) {
        return c.json({ error: "Claim not found" }, 404);
      }
      return c.json({ error: msg || "Failed to revoke claim" }, 500);
    }

    return c.json({ ok: true, claim_id: claimId });
  } catch (error) {
    logger.error(`revoke claim error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default adminClaims;
