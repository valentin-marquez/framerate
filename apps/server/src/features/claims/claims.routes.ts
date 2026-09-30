import { CreateClaimRequestSchema, type DnsCheck, type VerifyResult } from "@framerate/contracts";
import { checkTxt, claimTxtName, claimTxtValue, detectDnsProvider } from "@framerate/kit";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { currentUser } from "@/features/identity/middleware";
import { assertNotBanned } from "@/features/identity/policies";
import { findStore } from "@/features/stores/stores.repository";
import { AppError } from "@/shared/http/errors";
import { type ClaimRow, findClaim, listClaimsOf, liveClaimCount, recordClaimEvent, toClaim } from "./claims.repository";

/** Reclamo de tienda por TXT en el DNS. Todo aquí exige sesión (se monta bajo `requireUser`). */

const CLAIM_TTL_MS = 7 * 86_400_000;
const VERIFY_COOLDOWN_MS = 10_000;
const MAX_OPEN_CLAIMS = 5;

const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

async function ownClaim(c: Parameters<typeof currentUser>[0]): Promise<ClaimRow> {
  const id = z.coerce.number().int().positive().safeParse(c.req.param("id"));
  const claim = id.success ? await findClaim(c.var.db, id.data) : undefined;
  if (!claim || claim.claimant_id !== currentUser(c).id)
    throw new AppError(404, "claim_not_found", "Reclamo no encontrado");
  return claim;
}

const isExpired = (claim: ClaimRow, now: string) =>
  (claim.status === "pending" || claim.status === "verified") && claim.expires_at <= now;

async function expire(c: Parameters<typeof currentUser>[0], claim: ClaimRow, now: string): Promise<never> {
  await c.var.db.query
    .updateTable("store_claims")
    .set({ status: "expired", updated_at: now })
    .where("id", "=", claim.id)
    .execute();
  await recordClaimEvent(c.var.db, {
    claimId: claim.id,
    storeId: claim.store_id,
    action: "expired",
    actorId: null,
    now,
  });
  throw new AppError(410, "claim_expired", "El reclamo venció; inicia uno nuevo");
}

export const claimsRoutes = new Hono<AppEnv>()
  .get("/mine", async (c) => c.json({ items: (await listClaimsOf(c.var.db, currentUser(c).id)).map(toClaim) }))

  .post("/", async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const { storeSlug } = CreateClaimRequestSchema.parse(await c.req.json().catch(() => ({})));
    const store = await findStore(c.var.db, storeSlug);
    if (!store?.is_active) throw new AppError(404, "store_not_found", "Tienda no encontrada");

    const { domain } = store;
    if (!domain) throw new AppError(422, "no_domain", "Esta tienda no tiene un dominio verificable");
    if (store.organization_id !== null) throw new AppError(409, "already_claimed", "Esta tienda ya fue reclamada");
    if ((await liveClaimCount(c.var.db, user.id)) >= MAX_OPEN_CLAIMS) {
      throw new AppError(429, "too_many_claims", "Tienes demasiados reclamos en curso");
    }

    const now = new Date();
    const token = randomToken();
    const { provider, nameservers } = await detectDnsProvider(domain);
    const id = await c.var.db.query
      .insertInto("store_claims")
      .values({
        store_id: store.id,
        claimant_id: user.id,
        domain,
        token,
        dns_provider: provider,
        expires_at: new Date(now.getTime() + CLAIM_TTL_MS).toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .returning("id")
      .executeTakeFirstOrThrow()
      .then((row) => row.id)
      .catch((error: Error) => {
        if (error.message.includes("UNIQUE")) {
          throw new AppError(409, "claim_in_progress", "Ya hay un reclamo en curso para esta tienda");
        }
        throw error;
      });
    await recordClaimEvent(c.var.db, {
      claimId: id,
      storeId: store.id,
      action: "created",
      actorId: user.id,
      now: now.toISOString(),
    });
    const created = await findClaim(c.var.db, id);
    return c.json({ ...toClaim(created as ClaimRow), nameservers }, 201);
  })

  .get("/:id/dns-check", async (c) => {
    const claim = await ownClaim(c);
    if (claim.status !== "pending" && claim.status !== "verified") {
      throw new AppError(409, "claim_not_open", "Este reclamo ya no está en verificación");
    }
    const check = await checkTxt(claimTxtName(claim.domain), claimTxtValue(claim.token));
    return c.json<DnsCheck>({
      status: check.status,
      matched: check.status === "verified",
      expected: claimTxtValue(claim.token),
      found: check.found,
    });
  })

  .post("/:id/verify", async (c) => {
    const claim = await ownClaim(c);
    const now = new Date();
    const stamp = now.toISOString();
    if (claim.status !== "pending" && claim.status !== "verified") {
      throw new AppError(409, "claim_not_open", "Este reclamo ya no está en verificación");
    }
    if (isExpired(claim, stamp)) await expire(c, claim, stamp);
    if (claim.last_attempt_at && now.getTime() - Date.parse(claim.last_attempt_at) < VERIFY_COOLDOWN_MS) {
      throw new AppError(429, "too_soon", "Espera unos segundos antes de reintentar");
    }

    const expected = claimTxtValue(claim.token);
    const check = await checkTxt(claimTxtName(claim.domain), expected);
    const matched = check.status === "verified";
    const becameVerified = matched && claim.status === "pending";

    await c.var.db.query
      .updateTable("store_claims")
      .set({
        attempts: claim.attempts + 1,
        last_attempt_at: stamp,
        last_checked_at: stamp,
        updated_at: stamp,
        ...(becameVerified && { status: "verified", verified_at: stamp }),
      })
      .where("id", "=", claim.id)
      .execute();
    if (becameVerified) {
      await recordClaimEvent(c.var.db, {
        claimId: claim.id,
        storeId: claim.store_id,
        action: "verified",
        actorId: claim.claimant_id,
        now: stamp,
      });
    }

    return c.json<VerifyResult>({
      status: check.status,
      matched,
      expected,
      found: check.found,
      claimStatus: matched ? "verified" : claim.status,
      attempts: claim.attempts + 1,
      resolvers: check.resolvers,
    });
  })

  .post("/:id/confirm", async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const claim = await ownClaim(c);
    const stamp = new Date().toISOString();
    if (claim.status !== "verified") throw new AppError(409, "claim_not_verified", "Primero verifica el registro TXT");
    if (isExpired(claim, stamp)) await expire(c, claim, stamp);
    if (claim.organization_id !== null) throw new AppError(409, "already_claimed", "Esta tienda ya fue reclamada");

    const org = await c.var.db.query
      .insertInto("organizations")
      .values({ slug: `${claim.store_slug}-${claim.id}`, name: claim.store_name, created_at: stamp, updated_at: stamp })
      .onConflict((oc) => oc.column("slug").doUpdateSet({ updated_at: stamp }))
      .returning("id")
      .executeTakeFirstOrThrow();

    await c.var.db.batch([
      c.var.db.query
        .insertInto("organization_members")
        .values({ organization_id: org.id, user_id: user.id, role: "owner", created_at: stamp })
        .onConflict((oc) => oc.doNothing()),
      c.var.db.query
        .updateTable("stores")
        .set({ organization_id: org.id, verified_at: stamp, frozen_at: null })
        .where("id", "=", claim.store_id),
      c.var.db.query
        .updateTable("store_claims")
        .set({ status: "confirmed", confirmed_at: stamp, updated_at: stamp })
        .where("id", "=", claim.id),
      c.var.db.query.insertInto("store_claim_events").values({
        claim_id: claim.id,
        store_id: claim.store_id,
        action: "confirmed",
        actor_id: user.id,
        created_at: stamp,
      }),
    ]);
    return c.json({ storeSlug: claim.store_slug });
  });
