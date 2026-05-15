/**
 * Barrel API para la feature de moderacion (Fase 4).
 *
 * Las otras fases pueden importar el `ReportButton` reusable desde aqui:
 *
 *   import { ReportButton } from "~/features/moderation";
 *
 *   <ReportButton targetType="comment" targetId={comment.id} token={token} />
 */

export { ReportButton, type ReportButtonProps } from "./components/report-button";
export { ReportModal, type ReportModalProps } from "./components/report-modal";
export {
  type ModAction,
  moderationClient,
  type QueueItem,
  type ResolveDecision,
  type ResolvePayload,
} from "./services/moderation";
export {
  type CreateReportPayload,
  type Report,
  type ReportReason,
  type ReportStatus,
  type ReportTargetType,
  reportsClient,
} from "./services/reports";
