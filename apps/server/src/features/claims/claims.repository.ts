import type { Claim } from "@framerate/contracts";
import type { Db, StoreClaimEventsTable } from "@framerate/database";
import { claimTxtName, claimTxtValue } from "@framerate/kit";

const claimColumns = [
  "c.id",
  "c.store_id",
  "c.claimant_id",
  "c.domain",
  "c.token",
  "c.status",
  "c.attempts",
  "c.last_attempt_at",
  "c.last_checked_at",
  "c.verified_at",
  "c.dns_provider",
  "c.expires_at",
  "c.created_at",
  "s.slug as store_slug",
  "s.name as store_name",
  "s.organization_id",
] as const;

const claimsQuery = (db: Db) =>
  db.query.selectFrom("store_claims as c").innerJoin("stores as s", "s.id", "c.store_id").select(claimColumns);

export type ClaimRow = NonNullable<Awaited<ReturnType<ReturnType<typeof claimsQuery>["executeTakeFirst"]>>>;

export const findClaim = (db: Db, id: number) => claimsQuery(db).where("c.id", "=", id).executeTakeFirst();

export const listClaimsOf = (db: Db, userId: string) =>
  claimsQuery(db).where("c.claimant_id", "=", userId).orderBy("c.created_at", "desc").limit(20).execute();

export const liveClaimCount = async (db: Db, userId: string) =>
  Number(
    (
      await db.query
        .selectFrom("store_claims")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("claimant_id", "=", userId)
        .where("status", "in", ["pending", "verified"])
        .executeTakeFirstOrThrow()
    ).n,
  );

export function toClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    storeSlug: row.store_slug,
    storeName: row.store_name,
    domain: row.domain,
    txtName: claimTxtName(row.domain),
    txtValue: claimTxtValue(row.token),
    status: row.status,
    attempts: row.attempts,
    lastCheckedAt: row.last_checked_at,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    dnsProvider: row.dns_provider,
  };
}

export function recordClaimEvent(
  db: Db,
  event: {
    claimId: number;
    storeId: number;
    action: StoreClaimEventsTable["action"];
    actorId: string | null;
    reason?: string;
    now: string;
  },
) {
  return db.query
    .insertInto("store_claim_events")
    .values({
      claim_id: event.claimId,
      store_id: event.storeId,
      action: event.action,
      actor_id: event.actorId,
      reason: event.reason ?? null,
      created_at: event.now,
    })
    .execute();
}
