import { z } from "zod";

/** Reclamo de una tienda por registro TXT en su DNS (`/v1/claims/*`). */

export const CLAIM_STATUSES = ["pending", "verified", "confirmed", "expired", "stale", "revoked"] as const;
export const ClaimStatusSchema = z.enum(CLAIM_STATUSES);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const CreateClaimRequestSchema = z.object({ storeSlug: z.string().min(1).max(100) });
export type CreateClaimRequest = z.infer<typeof CreateClaimRequestSchema>;

export const ClaimSchema = z.object({
  id: z.number().int(),
  storeSlug: z.string(),
  storeName: z.string(),
  domain: z.string(),
  txtName: z.string(),
  txtValue: z.string(),
  status: ClaimStatusSchema,
  attempts: z.number().int(),
  lastCheckedAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
  dnsProvider: z.string().nullable(),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** Al crear se detectan además los nameservers, para mostrar instrucciones del proveedor. */
export const CreatedClaimSchema = ClaimSchema.extend({ nameservers: z.array(z.string()) });
export type CreatedClaim = z.infer<typeof CreatedClaimSchema>;

const ResolverSchema = z.object({ ok: z.boolean(), status: z.number().int(), records: z.array(z.string()) });

export const DnsCheckSchema = z.object({
  status: z.enum(["verified", "pending", "mismatch", "error"]),
  matched: z.boolean(),
  expected: z.string(),
  found: z.array(z.string()),
});
export type DnsCheck = z.infer<typeof DnsCheckSchema>;

export const VerifyResultSchema = DnsCheckSchema.extend({
  claimStatus: ClaimStatusSchema,
  attempts: z.number().int(),
  resolvers: z.object({ cloudflare: ResolverSchema, google: ResolverSchema }),
});
export type VerifyResult = z.infer<typeof VerifyResultSchema>;
