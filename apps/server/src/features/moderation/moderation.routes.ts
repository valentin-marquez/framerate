import {
  CreateReportRequestSchema,
  CreateTranslationFeedbackRequestSchema,
  ModerationActionListQuerySchema,
  ReportListQuerySchema,
  ReportQueueQuerySchema,
  ResolveReportRequestSchema,
} from "@framerate/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { canSanction } from "@/features/identity/domain/sanctions";
import { findActiveBan, findUserById } from "@/features/identity/identity.repository";
import { currentActor, currentUser } from "@/features/identity/middleware";
import { assertNotBanned } from "@/features/identity/policies";
import { actorRole, actorUserId } from "@/features/identity/types";
import { createBan } from "@/features/users-admin/users-admin.repository";
import { AppError } from "@/shared/http/errors";
import {
  actionRow,
  CLAIM_MINUTES,
  claimReport,
  createReport,
  createTranslationFeedback,
  getReport,
  listActions,
  listMyReports,
  listReports,
  resolveReport,
  resolveTarget,
  targetAuthor,
} from "./moderation.repository";

/** `/v1/reports` (con sesión), `/v1/translation-feedback` (sesión opcional) y `/v1/admin/moderation` (moderador+). */

const body = (c: { req: { json(): Promise<unknown> } }) => c.req.json().catch(() => ({}));
const reportNotFound = () => new AppError(404, "report_not_found", "Reporte no encontrado");
const reportId = (raw: string | undefined) => {
  const id = z.coerce.number().int().positive().safeParse(raw);
  if (!id.success) throw reportNotFound();
  return id.data;
};

export const reportsRoutes = new Hono<AppEnv>()
  .post("/", async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const input = CreateReportRequestSchema.parse(await body(c));
    const targetId = await resolveTarget(c.var.db, input.targetType, input.targetId);
    if (!targetId) throw new AppError(404, "target_not_found", "Lo que quieres reportar no existe");
    const id = await createReport(c.var.db, user.id, targetId, input, new Date().toISOString());
    if (id === null) throw new AppError(409, "already_reported", "Ya reportaste esto y sigue en revisión");
    return c.json({ id }, 201);
  })
  .get("/my", async (c) => c.json({ items: await listMyReports(c.var.db, currentUser(c).id) }));

export const translationFeedbackRoutes = new Hono<AppEnv>().post("/", async (c) => {
  const input = CreateTranslationFeedbackRequestSchema.parse(await body(c));
  const id = await createTranslationFeedback(c.var.db, c.get("user")?.id ?? null, input, new Date().toISOString());
  return c.json({ id }, 201);
});

export const moderationAdminRoutes = new Hono<AppEnv>()
  .get("/queue", async (c) => {
    const q = ReportQueueQuerySchema.parse(c.req.query());
    return c.json(await listReports(c.var.db, { queue: true, ...q }, new Date().toISOString()));
  })
  .get("/reports", async (c) => {
    const q = ReportListQuerySchema.parse(c.req.query());
    return c.json(await listReports(c.var.db, { queue: false, ...q }, new Date().toISOString()));
  })
  .get("/actions", async (c) =>
    c.json(await listActions(c.var.db, ModerationActionListQuerySchema.parse(c.req.query()))),
  )
  .post("/reports/:id/claim", async (c) => {
    const userId = actorUserId(currentActor(c));
    if (!userId) throw new AppError(403, "session_required", "Tomar un reporte requiere una cuenta, no el token");
    const id = reportId(c.req.param("id"));
    const now = new Date();
    const until = new Date(now.getTime() + CLAIM_MINUTES * 60_000).toISOString();
    if (!(await claimReport(c.var.db, id, userId, now.toISOString(), until))) {
      const report = await getReport(c.var.db, id, now.toISOString());
      if (!report) throw reportNotFound();
      if (report.status === "resolved" || report.status === "dismissed") {
        throw new AppError(409, "already_resolved", "El reporte ya está resuelto");
      }
      throw new AppError(409, "claimed_by_other", "Otra persona está revisando este reporte");
    }
    return c.json(await getReport(c.var.db, id, now.toISOString()));
  })
  .post("/reports/:id/resolve", async (c) => {
    const actor = currentActor(c);
    const actorId = actorUserId(actor);
    const input = ResolveReportRequestSchema.parse(await body(c));
    const id = reportId(c.req.param("id"));
    const now = new Date().toISOString();
    const report = await getReport(c.var.db, id, now);
    if (!report) throw reportNotFound();
    if (report.status === "resolved" || report.status === "dismissed") {
      throw new AppError(409, "already_resolved", "El reporte ya está resuelto");
    }
    if (report.claimedBy && report.claimedBy.id !== actorId) {
      throw new AppError(409, "claimed_by_other", "Otra persona está revisando este reporte");
    }

    const db = c.var.db;
    const note = input.note || null;
    const effects = [];
    const act = (action: Parameters<typeof actionRow>[1]["action"]) =>
      actionRow(db, {
        actorId,
        action,
        targetType: report.targetType,
        targetId: report.targetId,
        reportId: id,
        reason: note,
        now,
      });

    // ponytail: content_removed sólo borra comentarios y reseñas; producto, tienda y cotización quedan en la bitácora
    // para que quien modera actúe a mano (editar o fusionar el producto, congelar la tienda...).
    if (input.resolution === "content_removed") {
      const removal = { body: null, deleted_at: now, deleted_by: actorId, deletion_reason: "moderation" } as const;
      if (report.targetType === "comment") {
        effects.push(
          db.query
            .updateTable("comments")
            .set(removal)
            .where("id", "=", Number(report.targetId))
            .where("deleted_at", "is", null),
          act("comment_removed"),
        );
      } else if (report.targetType === "store_review") {
        const { deleted_at, deleted_by, deletion_reason } = removal;
        effects.push(
          db.query
            .updateTable("store_reviews")
            .set({ deleted_at, deleted_by, deletion_reason })
            .where("id", "=", Number(report.targetId))
            .where("deleted_at", "is", null),
          act("review_removed"),
        );
      }
    }

    if (input.resolution === "user_banned") {
      const authorId = await targetAuthor(db, report.targetType, report.targetId);
      const target = authorId ? await findUserById(db, authorId) : null;
      if (!target) throw new AppError(422, "no_ban_target", "Este reporte no tiene una persona a quien sancionar");
      if (target.id === actorId) throw new AppError(400, "cannot_target_self", "No puedes sancionarte a ti mismo");
      if (!canSanction(actorRole(actor), target.role)) {
        throw new AppError(403, "insufficient_role", "No puedes sancionar a alguien de tu mismo nivel o superior");
      }
      if (!(await findActiveBan(db, target.id, now))) {
        await createBan(db, { userId: target.id, reason: note, bannedBy: actorId, expiresAt: null, now });
        effects.push(
          actionRow(db, {
            actorId,
            action: "user_banned",
            targetType: "user",
            targetId: target.id,
            reportId: id,
            reason: note,
            now,
          }),
        );
      }
    }

    await resolveReport(db, { report, actorId, resolution: input.resolution, note, now, effects });
    return c.json(await getReport(db, id, now));
  });
