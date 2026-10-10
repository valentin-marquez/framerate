import type {
  AdminUserPage,
  ModerationAction,
  Report,
  ReportPage,
  ReportStatus,
  ReportTargetType,
  ResolveReportRequest,
  Role,
} from "@framerate/contracts";
import { api } from "~/shared/lib/api";

const BASE = "/v1/admin/moderation";

function query(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])));
}

export const moderationClient = {
  queue: (params: { page?: number; pageSize?: number } = {}) =>
    api.get<ReportPage>(`${BASE}/queue`, { params: query(params) }),

  listReports: (params: { status?: ReportStatus; targetType?: ReportTargetType; page?: number; pageSize?: number }) =>
    api.get<ReportPage>(`${BASE}/reports`, { params: query(params) }),

  listActions: (params: { targetType?: string; targetId?: string; page?: number; pageSize?: number } = {}) =>
    api.get<{ items: ModerationAction[]; page: number; pageSize: number; total: number }>(`${BASE}/actions`, {
      params: query(params),
    }),

  claim: (id: number) => api.post<Report>(`${BASE}/reports/${id}/claim`, {}),

  resolve: (id: number, payload: ResolveReportRequest) => api.post<Report>(`${BASE}/reports/${id}/resolve`, payload),

  listUsers: (params: { q?: string; filter?: string; page?: number }) =>
    api.get<AdminUserPage>("/v1/admin/users", { params: query(params) }),

  changeRole: (userId: string, role: Role) => api.patch(`/v1/admin/users/${userId}/role`, { role }),

  ban: (payload: { user_id: string; reason?: string; expires_at?: string | null }) =>
    api.post(`/v1/admin/users/${payload.user_id}/ban`, {
      reason: payload.reason,
      expiresAt: payload.expires_at ?? undefined,
    }),

  unban: (payload: { user_id: string }) => api.post(`/v1/admin/users/${payload.user_id}/unban`, {}),
};
