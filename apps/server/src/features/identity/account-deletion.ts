import type { Db } from "@framerate/database";
import { countAdmins } from "@/features/users-admin/users-admin.repository";
import { AppError } from "@/shared/http/errors";
import type { SessionUser } from "./types";

/**
 * Baja de cuenta: baja suave. Se anonimiza el perfil y se conserva la fila (la autoría de lo que queda y las FK
 * siguen en pie); la cuenta deja de existir para el resto del sistema por `deleted_at`. Los tickets de soporte se
 * conservan tal cual (pueden ser una solicitud de derechos ARCO) hasta que se defina cuánto tiempo guardarlos.
 */

/** Tiendas de las organizaciones donde el usuario es el único dueño: no puede irse sin traspasarlas. */
async function soleOwnerStores(db: Db, userId: string): Promise<string[]> {
  const rows = await db.query
    .selectFrom("organization_members as m")
    .innerJoin("organizations as o", "o.id", "m.organization_id")
    .leftJoin("stores as s", "s.organization_id", "o.id")
    .select(["o.name as organization", "s.slug as store"])
    .where("m.user_id", "=", userId)
    .where("m.role", "=", "owner")
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("organization_members as other")
            .select("other.user_id")
            .whereRef("other.organization_id", "=", "m.organization_id")
            .where("other.role", "=", "owner")
            .where("other.user_id", "!=", userId),
        ),
      ),
    )
    .execute();
  return [...new Set(rows.map((r) => r.store ?? r.organization))];
}

/** Anonimiza y desactiva la cuenta. Lanza 409 si es el único dueño de una tienda o el último administrador. */
export async function deleteAccount(db: Db, user: SessionUser, now: string): Promise<void> {
  const stores = await soleOwnerStores(db, user.id);
  if (stores.length > 0) {
    throw new AppError(
      409,
      "sole_owner",
      `Eres el único dueño de ${stores.join(", ")}. Suma otro dueño o libera la tienda antes de borrar tu cuenta.`,
    );
  }
  if (user.role === "admin" && (await countAdmins(db)) <= 1) {
    throw new AppError(409, "last_admin", "Eres el último administrador: nombra a otro antes de borrar tu cuenta");
  }

  const id = user.id;
  await db.batch([
    db.query
      .updateTable("users")
      .set({
        deleted_at: now,
        updated_at: now,
        username: `eliminado_${id.slice(0, 8).toLowerCase()}`,
        display_name: "Usuario eliminado",
        email: `eliminado+${id}@framerate.invalid`,
        email_verified: 0,
        avatar_key: null,
        avatar_source_url: null,
        bio: null,
        role: "user",
      })
      .where("id", "=", id),
    db.query.deleteFrom("auth_sessions").where("user_id", "=", id),
    db.query.deleteFrom("auth_accounts").where("user_id", "=", id),
    db.query.deleteFrom("auth_verifications").where("identifier", "=", user.email),
    db.query.deleteFrom("account_merges").where("survivor_id", "=", id),
    db.query.deleteFrom("organization_members").where("user_id", "=", id),
    db.query
      .updateTable("store_claims")
      .set({ status: "expired", updated_at: now })
      .where("claimant_id", "=", id)
      .where("status", "in", ["pending", "verified"]),
    // Lo que publicó se despublica como si lo hubiera borrado el autor; el texto se borra y queda la estructura.
    db.query
      .deleteFrom("quotes")
      .where("owner_id", "=", id),
    db.query.deleteFrom("store_review_votes").where("user_id", "=", id),
    db.query.deleteFrom("comment_likes").where("user_id", "=", id),
    db.query
      .updateTable("store_reviews")
      .set({ body: null, is_pinned: 0, deleted_at: now, deleted_by: id, deletion_reason: "author" })
      .where("user_id", "=", id)
      .where("deleted_at", "is", null),
    db.query
      .updateTable("comments")
      .set({ body: null, deleted_at: now, deleted_by: id, deletion_reason: "author" })
      .where("author_id", "=", id)
      .where("deleted_at", "is", null),
  ]);
}
