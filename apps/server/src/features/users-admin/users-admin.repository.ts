import type { AdminUser, Role } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { sql } from "kysely";
import type { ActiveBan } from "@/features/identity/types";

/** Acceso a datos de la administración de usuarios (búsqueda, sanciones, roles). */

/** Escapa `%`, `_` y `\` para usar el texto del admin como patrón LIKE literal. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function searchUsers(db: Db, q: string, limit: number, now: string): Promise<AdminUser[]> {
  const pattern = likePattern(q);
  const rows = await db.query
    .selectFrom("users")
    .select(["id", "username", "display_name", "role", "created_at"])
    .where("deleted_at", "is", null)
    .where((eb) =>
      eb.or([
        sql<boolean>`username LIKE ${pattern} ESCAPE '\\'`,
        sql<boolean>`display_name LIKE ${pattern} ESCAPE '\\'`,
        // El correo sólo coincide exacto: buscar por fragmento permitiría enumerar correos.
        eb("email", "=", q.toLowerCase()),
      ]),
    )
    .orderBy("username")
    .limit(limit)
    .execute();
  if (rows.length === 0) return [];

  const bans = await db.query
    .selectFrom("user_bans")
    .select(["user_id", "reason", "expires_at"])
    .where(
      "user_id",
      "in",
      rows.map((r) => r.id),
    )
    .where("lifted_at", "is", null)
    .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]))
    .orderBy("created_at", "desc")
    .execute();
  const banByUser = new Map<string, ActiveBan>();
  for (const b of bans) {
    if (!banByUser.has(b.user_id)) banByUser.set(b.user_id, { reason: b.reason, expiresAt: b.expires_at });
  }

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    createdAt: r.created_at,
    ban: banByUser.get(r.id) ?? null,
  }));
}

export async function createBan(
  db: Db,
  ban: { userId: string; reason: string | null; bannedBy: string | null; expiresAt: string | null; now: string },
) {
  await db.query
    .insertInto("user_bans")
    .values({
      user_id: ban.userId,
      reason: ban.reason,
      banned_by: ban.bannedBy,
      expires_at: ban.expiresAt,
      created_at: ban.now,
    })
    .execute();
}

/** Levanta las sanciones vigentes (se conserva la fila: es historial). Devuelve cuántas levantó. */
export async function liftActiveBans(db: Db, userId: string, liftedBy: string | null, now: string): Promise<number> {
  const rows = await db.query
    .updateTable("user_bans")
    .set({ lifted_at: now, lifted_by: liftedBy })
    .where("user_id", "=", userId)
    .where("lifted_at", "is", null)
    .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]))
    .returning("id")
    .execute();
  return rows.length;
}

export async function setRole(db: Db, userId: string, role: Role, now: string) {
  await db.query.updateTable("users").set({ role, updated_at: now }).where("id", "=", userId).execute();
}

export async function countAdmins(db: Db): Promise<number> {
  const row = await db.query
    .selectFrom("users")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("role", "=", "admin")
    .where("deleted_at", "is", null)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}
