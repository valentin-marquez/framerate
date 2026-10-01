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

// ponytail: la API v2 aún no tiene reportes (#23). En false no se muestra el botón de reportar; pasar a true con `/v1/reports`.
export const REPORTS_API_ENABLED = false;

export const reportsClient = {
  create: (payload: CreateReportPayload) => api.post<Report>("/v1/reports", payload),
};
