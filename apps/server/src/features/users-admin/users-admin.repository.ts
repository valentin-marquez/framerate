import { type AdminUserPage, ROLES, type Role } from "@framerate/contracts";
import type { Database, Db } from "@framerate/database";
import { type ExpressionBuilder, sql } from "kysely";
import type { ActiveBan } from "@/features/identity/types";
import { likePattern } from "@/shared/sql";

/** Acceso a datos de la administración de usuarios (búsqueda, sanciones, roles). */

export const USER_FILTERS = ["all", "staff", ...ROLES, "banned"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

const PAGE_SIZE = 50;

const activeBan = (now: string) => (eb: ExpressionBuilder<Database, "users">) =>
  eb.exists(
    eb
      .selectFrom("user_bans")
      .select("user_bans.id")
      .whereRef("user_bans.user_id", "=", "users.id")
      .where("lifted_at", "is", null)
      .where((w) => w.or([w("expires_at", "is", null), w("expires_at", ">", now)])),
  );

/**
 * Registrados, de los más nuevos a los más viejos (por handle si hay búsqueda), con el conteo de cada filtro.
 * El correo sólo va si lo pide un admin.
 */
export async function listUsers(
  db: Db,
  input: { q?: string; filter: UserFilter; page: number; withEmail: boolean; now: string },
): Promise<AdminUserPage> {
  const { q, filter, page, now } = input;
  let query = db.query.selectFrom("users").where("deleted_at", "is", null);
  if (q) {
    const pattern = likePattern(q);
    query = query.where((eb) =>
      eb.or([
        sql<boolean>`username LIKE ${pattern} ESCAPE '\\'`,
        sql<boolean>`display_name LIKE ${pattern} ESCAPE '\\'`,
        // El correo sólo coincide exacto: buscar por fragmento permitiría enumerar correos.
        eb("email", "=", q.toLowerCase()),
      ]),
    );
  }

  const counts = await query
    .select((eb) => [
      eb.fn.countAll<number>().as("all"),
      sql<number>`coalesce(sum(role != 'user'), 0)`.as("staff"),
      ...ROLES.map((role) => sql<number>`coalesce(sum(role = ${role}), 0)`.as(role)),
      sql<number>`coalesce(sum(${activeBan(now)(eb)}), 0)`.as("banned"),
    ])
    .executeTakeFirstOrThrow();

  if (filter === "staff") query = query.where("role", "!=", "user");
  else if (filter === "banned") query = query.where(activeBan(now));
  else if (filter !== "all") query = query.where("role", "=", filter);

  const rows = await query
    .select((eb) => [
      "id",
      "username",
      "display_name",
      "email",
      "role",
      "created_at",
      eb
        .selectFrom("auth_sessions")
        .select((s) => s.fn.max("updated_at").as("x"))
        .whereRef("auth_sessions.user_id", "=", "users.id")
        .as("last_seen_at"),
      eb
        .selectFrom("auth_accounts")
        .select(sql<string>`group_concat(provider_id)`.as("x"))
        .whereRef("auth_accounts.user_id", "=", "users.id")
        .as("providers"),
    ])
    .orderBy(q ? "username" : "created_at", q ? "asc" : "desc")
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE)
    .execute();

  const shown = rows.slice(0, PAGE_SIZE);
  const bans = shown.length
    ? await db.query
        .selectFrom("user_bans")
        .select(["user_id", "reason", "expires_at"])
        .where(
          "user_id",
          "in",
          shown.map((r) => r.id),
        )
        .where("lifted_at", "is", null)
        .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]))
        .orderBy("created_at", "desc")
        .execute()
    : [];
  const banByUser = new Map<string, ActiveBan>();
  for (const b of bans) {
    if (!banByUser.has(b.user_id)) banByUser.set(b.user_id, { reason: b.reason, expiresAt: b.expires_at });
  }

  return {
    items: shown.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      email: input.withEmail ? r.email : null,
      role: r.role,
      providers: r.providers ? [...new Set(r.providers.split(","))] : [],
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at ?? null,
      ban: banByUser.get(r.id) ?? null,
    })),
    hasMore: rows.length > PAGE_SIZE,
    counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])) as AdminUserPage["counts"],
  };
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
