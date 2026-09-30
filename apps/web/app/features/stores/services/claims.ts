import type { Claim, ClaimStatus, CreatedClaim, DnsCheck, VerifyResult } from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export type DnsProviderId =
  | "cloudflare"
  | "route53"
  | "gcdns"
  | "vercel"
  | "digitalocean"
  | "godaddy"
  | "namecheap"
  | "hostinger"
  | "azure"
  | "nic_cl"
  | "hostingplus_cl"
  | "sered_cl"
  | "bluehosting_cl";

export interface ClaimRequest {
  id: string;
  /** Slug de la tienda. */
  store_id: string;
  claimed_domain: string;
  txt_record_name: string;
  txt_record_value: string;
  status: ClaimStatus;
  attempts: number;
  last_checked_at: string | null;
  verified_at: string | null;
  expires_at: string;
  created_at: string;
  dns_provider: DnsProviderId | string | null;
  dns_nameservers: string[] | null;
}

export interface ClaimCreateResponse {
  id: string;
  domain: string;
  txt_name: string;
  txt_value: string;
  status: string;
  expires_at: string;
  dns_provider: DnsProviderId | string | null;
  dns_nameservers: string[];
}

/** Lo que cada resolver DoH vio para el TXT durante la verificación. */
export interface DnsResolverResult {
  ok: boolean;
  status: number;
  records: string[];
}

export interface ClaimVerifyResponse {
  id: string;
  status: string;
  matched: boolean;
  attempts?: number;
  dns?: {
    cloudflare: DnsResolverResult;
    google: DnsResolverResult;
  };
}

export type DnsCheckResponse = DnsCheck;

const toRequest = (c: Claim): ClaimRequest => ({
  id: String(c.id),
  store_id: c.storeSlug,
  claimed_domain: c.domain,
  txt_record_name: c.txtName,
  txt_record_value: c.txtValue,
  status: c.status,
  attempts: c.attempts,
  last_checked_at: c.lastCheckedAt,
  verified_at: c.verifiedAt,
  expires_at: c.expiresAt,
  created_at: c.createdAt,
  dns_provider: c.dnsProvider,
  dns_nameservers: null,
});

export const claimsService = {
  create: async (storeSlug: string, _token?: string): Promise<ClaimCreateResponse> => {
    const c = await api.post<CreatedClaim>("/v1/claims", { storeSlug });
    return {
      id: String(c.id),
      domain: c.domain,
      txt_name: c.txtName,
      txt_value: c.txtValue,
      status: c.status,
      expires_at: c.expiresAt,
      dns_provider: c.dnsProvider,
      dns_nameservers: c.nameservers,
    };
  },

  verify: async (id: string, _token?: string): Promise<ClaimVerifyResponse> => {
    const r = await api.post<VerifyResult>(`/v1/claims/${id}/verify`, {});
    return { id, status: r.claimStatus, matched: r.matched, attempts: r.attempts, dns: r.resolvers };
  },

  dnsCheck: (id: string, _token?: string) => api.get<DnsCheckResponse>(`/v1/claims/${id}/dns-check`),

  confirm: (id: string, _token?: string) => api.post<{ storeSlug: string }>(`/v1/claims/${id}/confirm`, {}),

  listMine: async (_token?: string): Promise<{ claims: ClaimRequest[] }> => ({
    claims: (await api.get<{ items: Claim[] }>("/v1/claims/mine")).items.map(toRequest),
  }),
};
