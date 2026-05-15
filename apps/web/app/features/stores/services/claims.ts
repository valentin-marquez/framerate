import { api } from "~/shared/lib/api";

export interface ClaimRequest {
  id: string;
  store_id: string | null;
  claimed_domain: string;
  txt_record_name: string;
  status: "pending" | "verified" | "failed" | "expired" | "revoked" | "stale";
  attempts: number;
  last_checked_at: string | null;
  verified_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ClaimCreateResponse {
  id: string;
  domain: string;
  txt_name: string;
  txt_value: string;
  status: string;
  expires_at: string;
  instructions: { es: string; en: string };
}

export interface ClaimVerifyResponse {
  id: string;
  status: string;
  matched: boolean;
  attempts?: number;
  dns?: unknown;
}

export const claimsService = {
  create: (domain: string, storeId: string | undefined, token: string) =>
    api.post<ClaimCreateResponse>("/v1/claims", { domain, store_id: storeId }, { token }),
  verify: (id: string, token: string) => api.post<ClaimVerifyResponse>(`/v1/claims/${id}/verify`, {}, { token }),
  confirm: (id: string, token: string) => api.post<{ store: unknown }>(`/v1/claims/${id}/confirm`, {}, { token }),
  listMine: (token: string) => api.get<{ claims: ClaimRequest[] }>("/v1/claims/my", { token }),
};
