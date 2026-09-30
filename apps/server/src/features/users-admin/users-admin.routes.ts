import { BanRequestSchema, ChangeRoleRequestSchema } from "@framerate/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { canSanction, checkBanExpiry } from "@/features/identity/domain/sanctions";
import { findActiveBan, findUserById } from "@/features/identity/identity.repository";
import { assertRole, currentActor } from "@/features/identity/middleware";
import { type Actor, actorRole, actorUserId } from "@/features/identity/types";
import { recordModerationAction } from "@/shared/audit";
import { AppError } from "@/shared/http/errors";
import { countAdmins, createBan, liftActiveBans, searchUsers, setRole } from "./users-admin.repository";

/** Administración de usuarios (montado bajo `/v1/admin/users`; mínimo moderador). */

const isSelf = (actor: Actor, targetId: string) => actor.kind === "user" && actor.user.id === targetId;

async function targetUser(c: Parameters<typeof currentActor>[0]) {
  const target = await findUserById(c.var.db, c.req.param("id") ?? "");
  if (!target) throw new AppError(404, "user_not_found", "Usuario no encontrado");
  return target;
}

export const usersAdminRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const query = z
      .object({
        q: z.string().trim().min(2, "Escribe al menos 2 caracteres").max(50),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(c.req.query());
    return c.json({ items: await searchUsers(c.var.db, query.q, query.limit, new Date().toISOString()) });
  })

  .post("/:id/ban", async (c) => {
    const actor = currentActor(c);
    const body = BanRequestSchema.parse(await c.req.json().catch(() => ({})));
    const target = await targetUser(c);
    const now = new Date().toISOString();

    if (isSelf(actor, target.id)) throw new AppError(400, "cannot_target_self", "No puedes sancionarte a ti mismo");
    if (!canSanction(actorRole(actor), target.role)) {
      throw new AppError(403, "insufficient_role", "No puedes sancionar a alguien de tu mismo nivel o superior");
    }
    if (!checkBanExpiry(body.expiresAt, now).ok) {
      throw new AppError(400, "invalid_expiry", "La fecha de término debe ser futura");
    }
    if (await findActiveBan(c.var.db, target.id, now)) {
      throw new AppError(409, "already_banned", "El usuario ya está suspendido");
    }

    const reason = body.reason || null;
    await createBan(c.var.db, {
      userId: target.id,
      reason,
      bannedBy: actorUserId(actor),
      expiresAt: body.expiresAt ?? null,
      now,
    });
    await recordModerationAction(c.var.db, {
      actorId: actorUserId(actor),
      action: "user_banned",
      targetType: "user",
      targetId: target.id,
      reason,
      after: { expiresAt: body.expiresAt ?? null },
      now,
    });
    return c.body(null, 204);
  })

  .post("/:id/unban", async (c) => {
    const actor = currentActor(c);
    const target = await targetUser(c);
    const now = new Date().toISOString();

    if (!canSanction(actorRole(actor), target.role)) {
      throw new AppError(403, "insufficient_role", "No puedes modificar la sanción de alguien de tu nivel o superior");
    }
    const lifted = await liftActiveBans(c.var.db, target.id, actorUserId(actor), now);
    if (lifted === 0) throw new AppError(409, "not_banned", "El usuario no tiene una suspensión vigente");

    await recordModerationAction(c.var.db, {
      actorId: actorUserId(actor),
      action: "user_unbanned",
      targetType: "user",
      targetId: target.id,
      now,
    });
    return c.body(null, 204);
  })

  .patch("/:id/role", async (c) => {
    assertRole(c, "admin");
    const actor = currentActor(c);
    const { role } = ChangeRoleRequestSchema.parse(await c.req.json().catch(() => ({})));
    const target = await targetUser(c);
    const now = new Date().toISOString();

    if (isSelf(actor, target.id)) throw new AppError(400, "cannot_target_self", "No puedes cambiar tu propio rol");
    if (target.role === role) return c.body(null, 204);
    if (target.role === "admin" && (await countAdmins(c.var.db)) <= 1) {
      throw new AppError(409, "last_admin", "Debe quedar al menos un administrador");
    }

    await setRole(c.var.db, target.id, role, now);
    await recordModerationAction(c.var.db, {
      actorId: actorUserId(actor),
      action: "role_changed",
      targetType: "user",
      targetId: target.id,
      before: { role: target.role },
      after: { role },
      now,
    });
    return c.body(null, 204);
  });
