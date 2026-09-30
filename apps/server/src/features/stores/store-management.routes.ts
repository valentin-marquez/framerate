import { AddStoreMemberRequestSchema, hasRole, type StoreRole, UpdateStoreRequestSchema } from "@framerate/contracts";
import { Hono } from "hono";
import type { AppEnv } from "@/app";
import { currentUser, requireUser } from "@/features/identity/middleware";
import { assertNotBanned } from "@/features/identity/policies";
import { AppError } from "@/shared/http/errors";
import {
  addMember,
  findMember,
  findUserByUsername,
  listMembers,
  removeMember,
  updateProfile,
} from "./store-management.repository";
import { findStore, storeRole } from "./stores.repository";

/**
 * Gestión de una tienda reclamada. Lo administra su organización; un admin de la plataforma puede hacer lo
 * mismo (moderación). Mientras la tienda está congelada (DNS dejó de verificar) sólo actúa el admin.
 */

const rank: Record<StoreRole, number> = { editor: 1, admin: 2, owner: 3 };

export const storeManagementRoutes = new Hono<AppEnv>()
  .patch("/stores/:slug", requireUser, async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const store = await findStore(c.var.db, c.req.param("slug"));
    if (!store) throw new AppError(404, "store_not_found", "Tienda no encontrada");
    const platformAdmin = hasRole(user.role, "admin");
    const role = await storeRole(c.var.db, store, user.id);
    if (!platformAdmin && !role) throw new AppError(403, "forbidden", "No administras esta tienda");
    if (!platformAdmin && store.frozen_at) {
      throw new AppError(423, "store_frozen", "La verificación DNS de la tienda venció; vuelve a verificarla");
    }
    const patch = UpdateStoreRequestSchema.parse(await c.req.json().catch(() => ({})));
    await updateProfile(c.var.db, store.id, patch, user.id, new Date().toISOString());
    return c.body(null, 204);
  })

  .get("/stores/:slug/members", requireUser, async (c) => {
    const user = currentUser(c);
    const store = await findStore(c.var.db, c.req.param("slug"));
    if (!store) throw new AppError(404, "store_not_found", "Tienda no encontrada");
    if (!hasRole(user.role, "admin") && !(await storeRole(c.var.db, store, user.id))) {
      throw new AppError(403, "forbidden", "No administras esta tienda");
    }
    return c.json({ items: store.organization_id === null ? [] : await listMembers(c.var.db, store.organization_id) });
  })

  .post("/stores/:slug/members", requireUser, async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const store = await findStore(c.var.db, c.req.param("slug"));
    if (!store) throw new AppError(404, "store_not_found", "Tienda no encontrada");
    const role = await storeRole(c.var.db, store, user.id);
    if (store.organization_id === null || !role || rank[role] < rank.admin) {
      throw new AppError(403, "forbidden", "Sólo dueños y administradores pueden sumar personas");
    }
    const body = AddStoreMemberRequestSchema.parse(await c.req.json().catch(() => ({})));
    const target = await findUserByUsername(c.var.db, body.username);
    if (!target) throw new AppError(404, "user_not_found", "No existe un usuario con ese nombre");
    if (await findMember(c.var.db, store.organization_id, target.id)) {
      throw new AppError(409, "already_member", "Esa persona ya es parte de la organización");
    }
    await addMember(c.var.db, {
      organizationId: store.organization_id,
      userId: target.id,
      role: body.role,
      invitedBy: user.id,
      now: new Date().toISOString(),
    });
    return c.body(null, 201);
  })

  .delete("/stores/:slug/members/:userId", requireUser, async (c) => {
    const user = currentUser(c);
    const store = await findStore(c.var.db, c.req.param("slug"));
    if (!store) throw new AppError(404, "store_not_found", "Tienda no encontrada");
    const role = await storeRole(c.var.db, store, user.id);
    const targetId = c.req.param("userId");
    const target =
      store.organization_id === null ? undefined : await findMember(c.var.db, store.organization_id, targetId);
    if (!target || store.organization_id === null)
      throw new AppError(404, "member_not_found", "Esa persona no es parte de la organización");

    const leaving = targetId === user.id;
    if (!leaving && (!role || rank[role] < rank.admin || rank[role] <= rank[target.role as StoreRole])) {
      throw new AppError(403, "forbidden", "No puedes quitar a alguien de tu mismo nivel o superior");
    }
    if (target.role === "owner") {
      const owners = (await listMembers(c.var.db, store.organization_id)).filter((m) => m.role === "owner");
      if (owners.length <= 1) throw new AppError(409, "last_owner", "La organización necesita al menos un dueño");
    }
    await removeMember(c.var.db, store.organization_id, targetId);
    return c.body(null, 204);
  });
