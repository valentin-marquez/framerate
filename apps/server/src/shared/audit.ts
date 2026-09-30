import type { Db, ModerationAction } from "@framerate/database";

/**
 * Bitácora única (append-only) de acciones privilegiadas: sanciones, cambios de
 * rol, moderación, reclamos, fusiones. `actorId` es null cuando actúa el token de servicio.
 */
export interface AuditEntry {
  actorId: string | null;
  action: ModerationAction;
  targetType: string;
  targetId: string;
  reportId?: number;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  now: string;
}

export async function recordModerationAction(db: Db, entry: AuditEntry) {
  await db.query
    .insertInto("moderation_actions")
    .values({
      actor_id: entry.actorId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      report_id: entry.reportId ?? null,
      reason: entry.reason ?? null,
      before: entry.before === undefined ? null : JSON.stringify(entry.before),
      after: entry.after === undefined ? null : JSON.stringify(entry.after),
      created_at: entry.now,
    })
    .execute();
}
