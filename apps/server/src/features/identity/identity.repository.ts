import type { Lang, Role, Theme, UpdateProfile } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import type { ActiveBan, SessionUser } from "./types";

/**
 * Acceso a datos de identidad. Better Auth escribe sesiones y cuentas; aquí se
 * lee el usuario con su rol y su sanción vigente, y se edita el perfil.
 */

export interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_key: string | null;
  avatar_source_url: string | null;
  bio: string | null;
  lang: Lang;
  theme: Theme;
  role: Role;
  created_at: string;
}

const USER_COLUMNS = [
  "id",
  "email",
  "username",
  "display_name",
  "avatar_key",
  "avatar_source_url",
  "bio",
  "lang",
  "theme",
  "role",
  "created_at",
] as const;

/** Sanción vigente: no levantada y (permanente o aún no expirada). */
export async function findActiveBan(db: Db, userId: string, now: string): Promise<ActiveBan | null> {
  const row = await db.query
    .selectFrom("user_bans")
    .select(["reason", "expires_at"])
    .where("user_id", "=", userId)
    .where("lifted_at", "is", null)
    .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]))
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  return row ? { reason: row.reason, expiresAt: row.expires_at } : null;
}

/** Usuario por id. Las cuentas eliminadas no existen para el resto del sistema. */
export async function findUserById(db: Db, id: string): Promise<UserRow | undefined> {
  return db.query
    .selectFrom("users")
    .select(USER_COLUMNS)
    .where("id", "=", id)
    .where("deleted_at", "is", null)
    .executeTakeFirst();
}

export async function findUserByUsername(db: Db, username: string): Promise<UserRow | undefined> {
  return db.query
    .selectFrom("users")
    .select(USER_COLUMNS)
    .where("username", "=", username)
    .where("deleted_at", "is", null)
    .executeTakeFirst();
}

/** Datos autoritativos del usuario de la petición (rol y sanción frescos). */
export async function loadSessionUser(db: Db, id: string, now: string): Promise<SessionUser | null> {
  const [user, ban] = await Promise.all([findUserById(db, id), findActiveBan(db, id, now)]);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    ban,
  };
}

export type UpdateProfileResult = "ok" | "username_taken";

/** Aplica cambios de perfil. Devuelve `username_taken` si el handle ya es de otro. */
export async function updateProfile(
  db: Db,
  userId: string,
  changes: UpdateProfile,
  now: string,
): Promise<UpdateProfileResult> {
  if (changes.username !== undefined) {
    const owner = await db.query
      .selectFrom("users")
      .select("id")
      .where("username", "=", changes.username)
      .executeTakeFirst();
    if (owner && owner.id !== userId) return "username_taken";
  }

  try {
    await db.query
      .updateTable("users")
      .set({
        ...(changes.displayName !== undefined && { display_name: changes.displayName }),
        ...(changes.username !== undefined && { username: changes.username }),
        ...(changes.bio !== undefined && { bio: changes.bio }),
        ...(changes.lang !== undefined && { lang: changes.lang }),
        ...(changes.theme !== undefined && { theme: changes.theme }),
        updated_at: now,
      })
      .where("id", "=", userId)
      .execute();
  } catch (error) {
    // Carrera entre dos cambios simultáneos al mismo handle: la restricción UNIQUE de la base decide.
    if (/UNIQUE constraint failed: users\.username/i.test(String(error))) return "username_taken";
    throw error;
  }
  return "ok";
}
