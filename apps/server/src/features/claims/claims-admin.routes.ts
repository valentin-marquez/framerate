import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { currentActor } from "@/features/identity/middleware";
import { actorUserId } from "@/features/identity/types";
import { recordModerationAction } from "@/shared/audit";
import { AppError } from "@/shared/http/errors";
import { findClaim, recordClaimEvent } from "./claims.repository";

/**
 * Revocar un reclamo desvincula la tienda, pero NO borra a los miembros de la organización:
 * ese vaciado masivo era un bug del sistema anterior.
 */
export const claimsAdminRoutes = new Hono<AppEnv>().post("/claims/:id/revoke", async (c) => {
  const actor = currentActor(c);
  const { reason } = z
    .object({ reason: z.string().trim().max(500).optional() })
    .parse(await c.req.json().catch(() => ({})));
  const id = z.coerce.number().int().positive().safeParse(c.req.param("id"));
  const claim = id.success ? await findClaim(c.var.db, id.data) : undefined;
  if (!claim) throw new AppError(404, "claim_not_found", "Reclamo no encontrado");
  if (claim.status === "revoked") throw new AppError(409, "already_revoked", "El reclamo ya estaba revocado");

  const now = new Date().toISOString();
  await c.var.db.batch([
    c.var.db.query.updateTable("store_claims").set({ status: "revoked", updated_at: now }).where("id", "=", claim.id),
    c.var.db.query
      .updateTable("stores")
      .set({ organization_id: null, verified_at: null, frozen_at: null })
      .where("id", "=", claim.store_id)
      .where("organization_id", "is not", null),
  ]);
  await recordClaimEvent(c.var.db, {
    claimId: claim.id,
    storeId: claim.store_id,
    action: "revoked",
    actorId: actorUserId(actor),
    reason,
    now,
  });
  await recordModerationAction(c.var.db, {
    actorId: actorUserId(actor),
    action: "claim_revoked",
    targetType: "store_claim",
    targetId: String(claim.id),
    reason: reason ?? null,
    now,
  });
  return c.body(null, 204);
});
