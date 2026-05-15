import { api } from "~/shared/lib/api";

export type ReportTargetType = "product" | "comment" | "store_review" | "store";

export type ReportReason =
  | "spam"
  | "harassment"
  | "misleading"
  | "duplicate"
  | "wrong_listing"
  | "broken_link"
  | "inappropriate"
  | "other";

export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface Report {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution_note?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface CreateReportPayload {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
}

export const reportsClient = {
  create: (payload: CreateReportPayload, token: string) => api.post<Report>("/v1/reports", payload, { token }),
  listMine: (token: string) => api.get<{ reports: Report[] }>("/v1/reports/my", { token }),
};
