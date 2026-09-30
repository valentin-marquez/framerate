import type { Db } from "@framerate/database";
import { checkTxt, claimTxtName, claimTxtValue } from "@framerate/kit";

/** Fallas conclusivas seguidas que congelan la tienda (con Cron cada 6 h ≈ 18 h de gracia). */
export const FAILURES_TO_FREEZE = 3;
const RECHECK_EVERY_MS = 5 * 3_600_000;
const BATCH = 50;

type ClaimEvent = "recheck_failed" | "stale" | "unfrozen" | "expired";

const event = (db: Db, claim: { id: number; store_id: number }, action: ClaimEvent, now: string, reason?: string) =>
  db.query.insertInto("store_claim_events").values({
    claim_id: claim.id,
    store_id: claim.store_id,
    action,
    actor_id: null,
    reason: reason ?? null,
    created_at: now,
  });

/**
 * Mantenimiento de reclamos: vence los que nadie completó y vuelve a verificar el TXT de las tiendas ya
 * reclamadas. Sólo cuenta como falla cuando AMBOS resolvers contestaron y el registro no está: una caída de
 * DoH no debe congelar la tienda de nadie.
 */
export async function recheckClaims(db: Db, now: string, check: typeof checkTxt = checkTxt) {
  const stats = { expired: 0, checked: 0, frozen: 0, recovered: 0 };

  const abandoned = await db.query
    .selectFrom("store_claims")
    .select(["id", "store_id"])
    .where("status", "in", ["pending", "verified"])
    .where("expires_at", "<=", now)
    .execute();
  for (const claim of abandoned) {
    await db.batch([
      db.query.updateTable("store_claims").set({ status: "expired", updated_at: now }).where("id", "=", claim.id),
      event(db, claim, "expired", now),
    ]);
    stats.expired++;
  }

  const since = new Date(Date.parse(now) - RECHECK_EVERY_MS).toISOString();
  const due = await db.query
    .selectFrom("store_claims")
    .select(["id", "store_id", "domain", "token", "status", "consecutive_failures"])
    .where("status", "in", ["confirmed", "stale"])
    .where((eb) => eb.or([eb("last_checked_at", "is", null), eb("last_checked_at", "<", since)]))
    .orderBy("last_checked_at")
    .limit(BATCH)
    .execute();

  for (const claim of due) {
    const result = await check(claimTxtName(claim.domain), claimTxtValue(claim.token));
    stats.checked++;
    const touch = { last_checked_at: now, updated_at: now };
    const update = db.query.updateTable("store_claims").where("id", "=", claim.id);

    if (result.status === "verified") {
      const recovering = claim.status === "stale";
      await db.batch([
        update.set({ ...touch, status: "confirmed", consecutive_failures: 0, last_error: null }),
        ...(recovering
          ? [
              db.query.updateTable("stores").set({ frozen_at: null }).where("id", "=", claim.store_id),
              event(db, claim, "unfrozen", now),
            ]
          : []),
      ]);
      if (recovering) stats.recovered++;
    } else if (!result.conclusive) {
      await update.set(touch).execute();
    } else {
      const failures = claim.consecutive_failures + 1;
      const freeze = claim.status === "confirmed" && failures >= FAILURES_TO_FREEZE;
      await db.batch([
        update.set({
          ...touch,
          consecutive_failures: failures,
          last_error: result.status,
          ...(freeze && { status: "stale" as const }),
        }),
        event(db, claim, "recheck_failed", now, result.status),
        ...(freeze
          ? [
              db.query.updateTable("stores").set({ frozen_at: now }).where("id", "=", claim.store_id),
              event(db, claim, "stale", now),
            ]
          : []),
      ]);
      if (freeze) stats.frozen++;
    }
  }
  return stats;
}
