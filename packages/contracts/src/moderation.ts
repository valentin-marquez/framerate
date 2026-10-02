import { z } from "zod";
import { pageSchema } from "./catalog";

/**
 * Moderación. Usuario (sesión): `POST /v1/reports`, `GET /v1/reports/my`. Anónimo o con sesión:
 * `POST /v1/translation-feedback`. Personal (moderador+) bajo `/v1/admin/moderation`: `GET /queue`, `GET /reports`,
 * `GET /actions`, `POST /reports/:id/claim`, `POST /reports/:id/resolve`. La cola es la tabla `reports`: un reporte
 * abierto o en revisión, que alguien puede "tomar" por un rato (`claimedBy`/`claimedUntil`).
 */

export const REPORT_TARGET_TYPES = ["product", "comment", "store_review", "store", "quote", "user"] as const;
export const ReportTargetTypeSchema = z.enum(REPORT_TARGET_TYPES);
export type ReportTargetType = z.infer<typeof ReportTargetTypeSchema>;

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "misleading",
  "duplicate",
  "wrong_listing",
  "broken_link",
  "wrong_price",
  "inappropriate",
  "other",
] as const;
export const ReportReasonSchema = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const ReportStatusSchema = z.enum(["open", "reviewing", "resolved", "dismissed"]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const REPORT_RESOLUTIONS = [
  "no_action",
  "content_removed",
  "user_banned",
  "listing_fixed",
  "duplicate_of_other",
] as const;
export const ReportResolutionSchema = z.enum(REPORT_RESOLUTIONS);
export type ReportResolution = z.infer<typeof ReportResolutionSchema>;

/**
 * `targetId`: id numérico para product, comment, store_review y store; `publicId` para quote; `username` para user.
 * 404 si no existe, 409 si ya tienes un reporte vivo sobre lo mismo.
 */
export const CreateReportRequestSchema = z.object({
  targetType: ReportTargetTypeSchema,
  targetId: z.string().trim().min(1).max(100),
  reason: ReportReasonSchema,
  details: z.string().trim().max(1000).optional(),
});
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;

/** Lo que ve quien reportó. */
export const MyReportSchema = z.object({
  id: z.number().int(),
  targetType: ReportTargetTypeSchema,
  targetId: z.string(),
  reason: ReportReasonSchema,
  details: z.string().nullable(),
  status: ReportStatusSchema,
  resolution: ReportResolutionSchema.nullable(),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});
export type MyReport = z.infer<typeof MyReportSchema>;

export const MyReportsSchema = z.object({ items: z.array(MyReportSchema) });

const StaffUserSchema = z.object({ id: z.string(), username: z.string(), displayName: z.string() });

/** Un reporte para el personal. `targetId` es el id canónico (de quote, su `publicId`; de user, su id de usuario). */
export const ReportSchema = z.object({
  id: z.number().int(),
  targetType: ReportTargetTypeSchema,
  targetId: z.string(),
  reason: ReportReasonSchema,
  details: z.string().nullable(),
  status: ReportStatusSchema,
  reporter: StaffUserSchema.nullable(),
  /** Vigente sólo si `claimedUntil` es futuro. */
  claimedBy: StaffUserSchema.nullable(),
  claimedUntil: z.iso.datetime().nullable(),
  resolution: ReportResolutionSchema.nullable(),
  resolutionNote: z.string().nullable(),
  resolvedBy: StaffUserSchema.nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /** Otros reportes vivos o resueltos sobre el mismo objetivo, para priorizar. */
  targetReportCount: z.number().int(),
});
export type Report = z.infer<typeof ReportSchema>;

export const ReportPageSchema = pageSchema(ReportSchema);
export type ReportPage = z.infer<typeof ReportPageSchema>;

/** `GET /v1/admin/moderation/reports`; sin `status`, todos. */
export const ReportListQuerySchema = z.object({
  status: ReportStatusSchema.optional(),
  targetType: ReportTargetTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ReportListQuery = z.infer<typeof ReportListQuerySchema>;

/** `GET /v1/admin/moderation/queue`: abiertos y en revisión, el más viejo primero. */
export const ReportQueueQuerySchema = ReportListQuerySchema.omit({ status: true });

export const ResolveReportRequestSchema = z.object({
  resolution: ReportResolutionSchema,
  note: z.string().trim().max(1000).optional(),
});
export type ResolveReportRequest = z.infer<typeof ResolveReportRequestSchema>;

export const ModerationActionTypeSchema = z.enum([
  "report_resolved",
  "report_dismissed",
  "comment_removed",
  "comment_restored",
  "review_removed",
  "review_restored",
  "user_banned",
  "user_unbanned",
  "role_changed",
  "claim_revoked",
  "store_frozen",
  "store_unfrozen",
  "product_merged",
  "product_edited",
  "match_reviewed",
]);

export const ModerationActionSchema = z.object({
  id: z.number().int(),
  actor: StaffUserSchema.nullable(),
  action: ModerationActionTypeSchema,
  targetType: z.string(),
  targetId: z.string(),
  reportId: z.number().int().nullable(),
  reason: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
});
export type ModerationAction = z.infer<typeof ModerationActionSchema>;

export const ModerationActionPageSchema = pageSchema(ModerationActionSchema);

/** `GET /v1/admin/moderation/actions`. */
export const ModerationActionListQuerySchema = z.object({
  targetType: z.string().max(40).optional(),
  targetId: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const TRANSLATION_LANGS = ["es", "en", "arn"] as const;

/** `POST /v1/translation-feedback` (sin sesión también). Responde 201 `{ id }`. */
export const CreateTranslationFeedbackRequestSchema = z.object({
  lang: z.enum(TRANSLATION_LANGS),
  translationKey: z.string().trim().min(1).max(200),
  currentText: z.string().max(2000).optional(),
  suggestedText: z.string().trim().min(1).max(2000),
  comment: z.string().trim().max(2000).optional(),
  contextPath: z.string().max(1000).optional(),
});
export type CreateTranslationFeedbackRequest = z.infer<typeof CreateTranslationFeedbackRequestSchema>;
