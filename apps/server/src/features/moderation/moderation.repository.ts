import type {
  CreateReportRequest,
  CreateTranslationFeedbackRequest,
  ModerationAction,
  MyReport,
  Report,
  ReportResolution,
  ReportTargetType,
} from "@framerate/contracts";
import type { Db, ModerationAction as ModerationActionType } from "@framerate/database";
import { sql } from "kysely";

/** Reportes, bitácora de moderación y feedback de traducciones. */

export const CLAIM_MINUTES = 15;

const numericTargets = {
  product: "products",
  comment: "comments",
  store_review: "store_reviews",
  store: "stores",
} as const;

/** Id canónico del objetivo (quote: public_id, user: id de usuario), o null si no existe. */
export async function resolveTarget(db: Db, type: ReportTargetType, raw: string) {
  const query =
    type === "quote"
      ? sql<{ id: string }>`select public_id as id from quotes where public_id = ${raw}`
      : type === "user"
        ? sql<{ id: string }>`select id from users where username = ${raw.toLowerCase()} and deleted_at is null`
        : sql<{
            id: string;
          }>`select cast(id as text) as id from ${sql.table(numericTargets[type])} where id = ${/^\d+$/.test(raw) ? Number(raw) : -1}`;
  return (await query.execute(db.query)).rows[0]?.id ?? null;
}

/** false si el denunciante ya tiene un reporte vivo sobre lo mismo (índice único). */
export async function createReport(
  db: Db,
  reporterId: string,
  targetId: string,
  input: CreateReportRequest,
  now: string,
) {
  const rows = await db.query
    .insertInto("reports")
    .values({
      target_type: input.targetType,
      target_id: targetId,
      reporter_id: reporterId,
      reason: input.reason,
      details: input.details || null,
      created_at: now,
    })
    .onConflict((oc) =>
      oc
        .columns(["target_type", "target_id", "reporter_id"])
        .where(sql<boolean>`status IN ('open', 'reviewing')`)
        .doNothing(),
    )
    .returning("id")
    .execute();
  return rows[0]?.id ?? null;
}

export async function listMyReports(db: Db, userId: string): Promise<MyReport[]> {
  const rows = await db.query
    .selectFrom("reports")
    .selectAll()
    .where("reporter_id", "=", userId)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(100)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    resolution: r.resolution,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }));
}

const reportsBase = (db: Db) => db.query.selectFrom("reports as r");

const staff = (id: string | null, username: string | null, displayName: string | null) =>
  id && username && displayName ? { id, username, displayName } : null;

const reportsQuery = (db: Db) => withJoins(db.query.selectFrom("reports as r"));

const withJoins = (base: ReturnType<typeof reportsBase>) =>
  base
    .leftJoin("users as rep", "rep.id", "r.reporter_id")
    .leftJoin("users as cl", "cl.id", "r.claimed_by")
    .leftJoin("users as rs", "rs.id", "r.resolved_by")
    .selectAll("r")
    .select([
      "rep.username as rep_username",
      "rep.display_name as rep_name",
      "cl.username as cl_username",
      "cl.display_name as cl_name",
      "rs.username as rs_username",
      "rs.display_name as rs_name",
      sql<number>`(select count(*) from reports o where o.target_type = r.target_type and o.target_id = r.target_id)`.as(
        "target_count",
      ),
    ]);

type ReportRow = Awaited<ReturnType<ReturnType<typeof reportsQuery>["executeTakeFirstOrThrow"]>>;

const toReport = (r: ReportRow, now: string): Report => ({
  id: r.id,
  targetType: r.target_type,
  targetId: r.target_id,
  reason: r.reason,
  details: r.details,
  status: r.status,
  reporter: staff(r.reporter_id, r.rep_username, r.rep_name),
  claimedBy: r.claimed_until && r.claimed_until > now ? staff(r.claimed_by, r.cl_username, r.cl_name) : null,
  claimedUntil: r.claimed_until && r.claimed_until > now ? r.claimed_until : null,
  resolution: r.resolution,
  resolutionNote: r.resolution_note,
  resolvedBy: staff(r.resolved_by, r.rs_username, r.rs_name),
  resolvedAt: r.resolved_at,
  createdAt: r.created_at,
  targetReportCount: Number(r.target_count),
});

export async function getReport(db: Db, id: number, now: string) {
  const row = await reportsQuery(db).where("r.id", "=", id).executeTakeFirst();
  return row ? toReport(row, now) : null;
}

/** `queue`: abiertos y en revisión, el más viejo primero. Si no, lista por filtros, el más nuevo primero. */
export async function listReports(
  db: Db,
  f: { queue: boolean; status?: Report["status"]; targetType?: ReportTargetType; page: number; pageSize: number },
  now: string,
) {
  const base = reportsBase(db)
    .$if(f.queue, (q) => q.where("r.status", "in", ["open", "reviewing"]))
    .$if(!!f.status, (q) => q.where("r.status", "=", f.status as Report["status"]))
    .$if(!!f.targetType, (q) => q.where("r.target_type", "=", f.targetType as ReportTargetType));
  const [rows, [total]] = await db.read([
    withJoins(base)
      .orderBy("r.created_at", f.queue ? "asc" : "desc")
      .orderBy("r.id", f.queue ? "asc" : "desc")
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    base.select((eb) => eb.fn.countAll<number>().as("n")),
  ]);
  return {
    items: rows.map((r) => toReport(r, now)),
    page: f.page,
    pageSize: f.pageSize,
    total: Number(total?.n ?? 0),
  };
}

/** Toma el reporte si está vivo y nadie más lo tiene vigente. Devuelve si lo tomó. */
export async function claimReport(db: Db, id: number, userId: string, now: string, until: string) {
  const rows = await db.query
    .updateTable("reports")
    .set({ status: "reviewing", claimed_by: userId, claimed_until: until })
    .where("id", "=", id)
    .where("status", "in", ["open", "reviewing"])
    .where((eb) => eb.or([eb("claimed_by", "is", null), eb("claimed_by", "=", userId), eb("claimed_until", "<=", now)]))
    .returning("id")
    .execute();
  return rows.length > 0;
}

export interface ResolveInput {
  report: Report;
  actorId: string | null;
  resolution: ReportResolution;
  note: string | null;
  now: string;
  /** Efectos extra ya compilados (borrado de contenido, sanción) y sus filas de bitácora. */
  effects: Parameters<Db["batch"]>[0];
}

/** Estado, resolución y bitácora en un solo lote, junto con los efectos sobre el contenido. */
export async function resolveReport(db: Db, i: ResolveInput) {
  const dismissed = i.resolution === "no_action";
  await db.batch([
    db.query
      .updateTable("reports")
      .set({
        status: dismissed ? "dismissed" : "resolved",
        resolution: i.resolution,
        resolution_note: i.note,
        resolved_by: i.actorId,
        resolved_at: i.now,
        claimed_by: null,
        claimed_until: null,
      })
      .where("id", "=", i.report.id)
      .where("status", "in", ["open", "reviewing"]),
    ...i.effects,
    db.query.insertInto("moderation_actions").values({
      actor_id: i.actorId,
      action: dismissed ? "report_dismissed" : "report_resolved",
      target_type: i.report.targetType,
      target_id: i.report.targetId,
      report_id: i.report.id,
      reason: i.note,
      after: JSON.stringify({ resolution: i.resolution }),
      created_at: i.now,
    }),
  ]);
}

/** Fila de bitácora compilable, para sumar al lote de `resolveReport`. */
export const actionRow = (
  db: Db,
  a: {
    actorId: string | null;
    action: ModerationActionType;
    targetType: string;
    targetId: string;
    reportId: number;
    reason: string | null;
    now: string;
  },
) =>
  db.query.insertInto("moderation_actions").values({
    actor_id: a.actorId,
    action: a.action,
    target_type: a.targetType,
    target_id: a.targetId,
    report_id: a.reportId,
    reason: a.reason,
    created_at: a.now,
  });

/** Quién es responsable del contenido reportado (a quién sancionar), o null. */
export async function targetAuthor(db: Db, type: ReportTargetType, id: string): Promise<string | null> {
  if (type === "user") return id;
  const q =
    type === "comment"
      ? db.query.selectFrom("comments").select("author_id as u").where("id", "=", Number(id))
      : type === "store_review"
        ? db.query.selectFrom("store_reviews").select("user_id as u").where("id", "=", Number(id))
        : type === "quote"
          ? db.query.selectFrom("quotes").select("owner_id as u").where("public_id", "=", id)
          : null;
  return q ? ((await q.executeTakeFirst())?.u ?? null) : null;
}

export async function listActions(
  db: Db,
  f: { targetType?: string; targetId?: string; page: number; pageSize: number },
): Promise<{ items: ModerationAction[]; page: number; pageSize: number; total: number }> {
  const base = db.query
    .selectFrom("moderation_actions as a")
    .$if(!!f.targetType, (q) => q.where("a.target_type", "=", f.targetType as string))
    .$if(!!f.targetId, (q) => q.where("a.target_id", "=", f.targetId as string));
  const [rows, [total]] = await db.read([
    base
      .leftJoin("users as u", "u.id", "a.actor_id")
      .selectAll("a")
      .select(["u.username", "u.display_name"])
      .orderBy("a.created_at", "desc")
      .orderBy("a.id", "desc")
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    base.select((eb) => eb.fn.countAll<number>().as("n")),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      actor: staff(r.actor_id, r.username, r.display_name),
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      reportId: r.report_id,
      reason: r.reason,
      before: r.before ? JSON.parse(r.before) : null,
      after: r.after ? JSON.parse(r.after) : null,
      createdAt: r.created_at,
    })),
    page: f.page,
    pageSize: f.pageSize,
    total: Number(total?.n ?? 0),
  };
}

export async function createTranslationFeedback(
  db: Db,
  userId: string | null,
  input: CreateTranslationFeedbackRequest,
  now: string,
) {
  const row = await db.query
    .insertInto("translation_feedback")
    .values({
      user_id: userId,
      lang: input.lang,
      translation_key: input.translationKey,
      current_text: input.currentText || null,
      suggested_text: input.suggestedText,
      comment: input.comment || null,
      context_path: input.contextPath || null,
      created_at: now,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
