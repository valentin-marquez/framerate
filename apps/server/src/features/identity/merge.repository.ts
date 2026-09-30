import type { MergePreview } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { sql } from "kysely";

/**
 * Fusión de usuarios: B (el de la sesión) se absorbe en A (el que la inició). A conserva su perfil;
 * todo lo que apunta a B pasa a A y B se borra.
 */

/** Toda columna con FK a `users(id)`. Un test la compara con `pragma_foreign_key_list`: una FK nueva no se olvida. */
export const USER_REFERENCES: Readonly<Record<string, readonly string[]>> = {
  auth_accounts: ["user_id"],
  auth_sessions: ["user_id"],
  user_bans: ["user_id", "banned_by", "lifted_by"],
  account_merges: ["survivor_id"],
  organization_members: ["user_id", "invited_by"],
  organization_invitations: ["invited_by", "accepted_by"],
  store_profiles: ["updated_by"],
  store_claims: ["claimant_id"],
  store_claim_events: ["actor_id"],
  store_reviews: ["user_id", "owner_response_by", "deleted_by"],
  store_review_votes: ["user_id"],
  quotes: ["owner_id"],
  comments: ["author_id", "deleted_by"],
  comment_likes: ["user_id"],
  reports: ["reporter_id", "claimed_by", "resolved_by"],
  moderation_actions: ["actor_id"],
  translation_feedback: ["user_id", "reviewed_by"],
  support_tickets: ["user_id", "assigned_to"],
  support_messages: ["author_id"],
  outbound_clicks: ["user_id"],
};

/** Una fusión pendiente por usuario: empezar otra reemplaza la anterior. */
export async function startMerge(db: Db, survivorId: string, tokenHash: string, now: string, expiresAt: string) {
  await db.batch([
    db.query.deleteFrom("account_merges").where("survivor_id", "=", survivorId).where("status", "=", "pending"),
    db.query
      .insertInto("account_merges")
      .values({ survivor_id: survivorId, token_hash: tokenHash, created_at: now, expires_at: expiresAt }),
  ]);
}

export const findPendingMerge = (db: Db, tokenHash: string) =>
  db.query
    .selectFrom("account_merges")
    .select(["id", "survivor_id", "expires_at"])
    .where("token_hash", "=", tokenHash)
    .where("status", "=", "pending")
    .executeTakeFirst();

export const cancelMerge = (db: Db, tokenHash: string) =>
  db.query.deleteFrom("account_merges").where("token_hash", "=", tokenHash).where("status", "=", "pending").execute();

export async function providersOf(db: Db, userId: string): Promise<string[]> {
  const rows = await db.query
    .selectFrom("auth_accounts")
    .select("provider_id")
    .where("user_id", "=", userId)
    .orderBy("created_at")
    .execute();
  return rows.map((r) => r.provider_id);
}

/** Lo que B aporta (y verá en la previsualización). */
export async function mergeCounts(db: Db, userId: string): Promise<MergePreview["counts"]> {
  const { rows } = await sql<MergePreview["counts"]>`SELECT
    (SELECT count(*) FROM store_reviews WHERE user_id = ${userId} AND deleted_at IS NULL) AS reviews,
    (SELECT count(*) FROM comments WHERE author_id = ${userId} AND deleted_at IS NULL) AS comments,
    (SELECT count(*) FROM organization_members WHERE user_id = ${userId}) AS organizations,
    (SELECT count(*) FROM store_claims WHERE claimant_id = ${userId}) AS claims,
    (SELECT count(*) FROM quotes WHERE owner_id = ${userId}) AS quotes,
    (SELECT count(*) FROM support_tickets WHERE user_id = ${userId}) AS tickets`.execute(db.query);
  const [counts] = rows;
  if (!counts) throw new Error("mergeCounts: sin fila");
  return counts;
}

const orgRank = (role: string) => `CASE ${role} WHEN 'owner' THEN 3 WHEN 'admin' THEN 2 ELSE 1 END`;
const userRank = `CASE role WHEN 'admin' THEN 3 WHEN 'moderator' THEN 2 ELSE 1 END`;

/**
 * Absorbe B en A en un solo batch de D1 (una transacción). SQL directo porque recorre `USER_REFERENCES`
 * con nombres de tabla dinámicos (constantes, nunca entrada del usuario).
 */
export async function mergeUsers(
  d1: D1Database,
  input: {
    mergeId: number;
    survivorId: string;
    absorbed: { id: string; username: string; email: string };
    summary: object;
    now: string;
  },
) {
  const { survivorId: a, absorbed, now } = input;
  const b = absorbed.id;
  const run = (query: string, ...params: unknown[]) => d1.prepare(query).bind(...params);
  const references = Object.entries(USER_REFERENCES).flatMap(([table, columns]) => columns.map((c) => [table, c]));

  await d1.batch([
    // Las sesiones de B se revocan, no pasan a A: una cookie de B (o un token robado) no debe entrar como A.
    run("DELETE FROM auth_sessions WHERE user_id = ?", b),
    // Una reseña activa por tienda y usuario: si ambos reseñaron la misma, queda la más reciente.
    // Los triggers de `store_reviews` recalculan `stores.rating_count/rating_sum`.
    run(
      `UPDATE store_reviews SET deleted_at = ?1, deletion_reason = 'author'
       WHERE deleted_at IS NULL AND user_id IN (?2, ?3) AND EXISTS (
         SELECT 1 FROM store_reviews o
         WHERE o.store_id = store_reviews.store_id AND o.deleted_at IS NULL
           AND o.user_id IN (?2, ?3) AND o.user_id <> store_reviews.user_id
           AND (o.created_at, o.id) > (store_reviews.created_at, store_reviews.id))`,
      now,
      a,
      b,
    ),
    // Misma organización: A se queda con el rol mayor.
    run(
      `UPDATE organization_members AS m SET role = o.role FROM organization_members AS o
       WHERE m.user_id = ?1 AND o.user_id = ?2 AND o.organization_id = m.organization_id
         AND ${orgRank("o.role")} > ${orgRank("m.role")}`,
      a,
      b,
    ),
    ...references.map(([table, column]) =>
      run(`UPDATE OR IGNORE ${table} SET ${column} = ?1 WHERE ${column} = ?2`, a, b),
    ),
    // Lo que no se movió chocó con una fila igual de A (voto, like, membresía o reporte repetido): sobra.
    // Borrar votos y likes descuenta sus contadores por trigger.
    ...references.map(([table, column]) => run(`DELETE FROM ${table} WHERE ${column} = ?`, b)),
    run(
      `UPDATE users SET
         role = (SELECT role FROM users WHERE id IN (?1, ?2) ORDER BY ${userRank} DESC LIMIT 1),
         email_verified = max(email_verified, (SELECT email_verified FROM users WHERE id = ?2)),
         created_at = min(created_at, (SELECT created_at FROM users WHERE id = ?2)),
         updated_at = ?3
       WHERE id = ?1`,
      a,
      b,
      now,
    ),
    run(
      `UPDATE account_merges SET status = 'done', absorbed_id = ?, absorbed_username = ?, absorbed_email = ?,
         summary = ?, completed_at = ? WHERE id = ?`,
      b,
      absorbed.username,
      absorbed.email,
      JSON.stringify(input.summary),
      now,
      input.mergeId,
    ),
    run("DELETE FROM users WHERE id = ?", b),
  ]);
}
