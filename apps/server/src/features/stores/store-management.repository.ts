import type { StoreMember, StoreRole, UpdateStoreRequest } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { avatarUrl } from "@/features/identity/domain/avatar";

/** Perfil editable de la tienda y miembros de su organización. */

export async function updateProfile(db: Db, storeId: number, patch: UpdateStoreRequest, actorId: string, now: string) {
  const values = {
    ...(patch.displayName !== undefined && { display_name: patch.displayName }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.website !== undefined && { website_url: patch.website }),
    ...(patch.social !== undefined && { social: JSON.stringify(patch.social) }),
    updated_by: actorId,
    updated_at: now,
  };
  await db.query
    .insertInto("store_profiles")
    .values({ store_id: storeId, ...values })
    .onConflict((oc) => oc.column("store_id").doUpdateSet(values))
    .execute();
}

export async function listMembers(db: Db, organizationId: number): Promise<StoreMember[]> {
  const rows = await db.query
    .selectFrom("organization_members as m")
    .innerJoin("users as u", "u.id", "m.user_id")
    .select([
      "m.user_id",
      "m.role",
      "m.created_at",
      "u.username",
      "u.display_name",
      "u.avatar_key",
      "u.avatar_source_url",
    ])
    .where("m.organization_id", "=", organizationId)
    .where("u.deleted_at", "is", null)
    .orderBy("m.created_at")
    .execute();
  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: avatarUrl(r),
    role: r.role as StoreRole,
    createdAt: r.created_at,
  }));
}

export const findMember = (db: Db, organizationId: number, userId: string) =>
  db.query
    .selectFrom("organization_members")
    .select("role")
    .where("organization_id", "=", organizationId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

export const findUserByUsername = (db: Db, username: string) =>
  db.query
    .selectFrom("users")
    .select("id")
    .where("username", "=", username.toLowerCase())
    .where("deleted_at", "is", null)
    .executeTakeFirst();

export const addMember = (
  db: Db,
  member: { organizationId: number; userId: string; role: "admin" | "editor"; invitedBy: string; now: string },
) =>
  db.query
    .insertInto("organization_members")
    .values({
      organization_id: member.organizationId,
      user_id: member.userId,
      role: member.role,
      invited_by: member.invitedBy,
      created_at: member.now,
    })
    .execute();

export const removeMember = (db: Db, organizationId: number, userId: string) =>
  db.query
    .deleteFrom("organization_members")
    .where("organization_id", "=", organizationId)
    .where("user_id", "=", userId)
    .execute();
