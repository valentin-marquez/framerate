import type { AdminUser } from "@framerate/contracts";
import { api } from "~/shared/lib/api";
import type { Report, ReportStatus } from "./reports";

export interface QueueItem {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  report_id: string;
  target_type: Report["target_type"];
  target_id: string;
  reason: Report["reason"];
  details: string | null;
  reporter_id: string | null;
  status: ReportStatus;
  report_created_at: string;
  target_snapshot: Record<string, unknown> | null;
}

export interface ModAction {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type ResolveDecision = "resolved" | "dismissed" | "reviewing";

export interface ResolvePayload {
  msg_id: number;
  report_id: string;
  decision: ResolveDecision;
  note?: string;
}

export const moderationClient = {
  getQueueItem: () => api.get<{ item: QueueItem | null }>("/v1/admin/moderation/queue"),

  resolve: (payload: ResolvePayload) => api.post<{ success: boolean }>("/v1/admin/moderation/resolve", payload),

  listReports: (params: { status?: ReportStatus; limit?: number }) =>
    api.get<{ reports: Report[] }>("/v1/admin/moderation/reports", {
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  listModActions: (params: { actor_id?: string; target_type?: string; limit?: number }) =>
    api.get<{ actions: ModAction[] }>("/v1/admin/moderation/mod-actions", {
      params: {
        ...(params.actor_id ? { actor_id: params.actor_id } : {}),
        ...(params.target_type ? { target_type: params.target_type } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  flagProduct: (payload: { product_id: string; reason?: string }) =>
    api.post<{ recheck_id: string }>("/v1/admin/moderation/flag-product", payload),

  searchUsers: (q: string) => api.get<{ items: AdminUser[] }>("/v1/admin/users", { params: { q } }),

  ban: (payload: { user_id: string; reason?: string; expires_at?: string | null }) =>
    api.post(`/v1/admin/users/${payload.user_id}/ban`, {
      reason: payload.reason,
      expiresAt: payload.expires_at ?? undefined,
    }),

  unban: (payload: { user_id: string }) => api.post(`/v1/admin/users/${payload.user_id}/unban`, {}),
};
