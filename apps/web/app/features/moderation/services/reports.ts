import type { CreateReportRequest, MyReport, ReportReason, ReportTargetType } from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export const reportsClient = {
  create: (payload: CreateReportRequest) => api.post<{ id: number }>("/v1/reports", payload),
  mine: () => api.get<{ items: MyReport[] }>("/v1/reports/my"),
};

export const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam o promocional",
  harassment: "Acoso o abuso",
  misleading: "Información engañosa",
  duplicate: "Duplicado",
  wrong_listing: "La oferta no corresponde al producto",
  broken_link: "Enlace roto o producto no disponible",
  wrong_price: "El precio no coincide con la tienda",
  inappropriate: "Contenido inapropiado",
  other: "Otro motivo",
};

export const TARGET_LABELS: Record<ReportTargetType, string> = {
  product: "Producto",
  comment: "Comentario",
  store_review: "Reseña",
  store: "Tienda",
  quote: "Cotización",
  user: "Usuario",
};

const CONTENT: ReportReason[] = ["spam", "harassment", "misleading", "inappropriate", "other"];

/** Los motivos que tienen sentido para cada tipo de objetivo. */
export const REASONS_BY_TARGET: Record<ReportTargetType, ReportReason[]> = {
  product: ["wrong_price", "wrong_listing", "broken_link", "duplicate", "misleading", "other"],
  comment: CONTENT,
  store_review: CONTENT,
  store: ["misleading", "inappropriate", "other"],
  quote: CONTENT,
  user: ["spam", "harassment", "inappropriate", "other"],
};
