import type { RecordClickRequest } from "@framerate/contracts";
import type { Db } from "@framerate/database";

const numericId = (ref: string | null | undefined) => {
  const n = Number(ref);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

async function findStoreId(db: Db, ref: string | null | undefined) {
  if (!ref) return null;
  const id = numericId(ref);
  const row = await db.query
    .selectFrom("stores")
    .select("id")
    .where((eb) => (id ? eb.or([eb("id", "=", id), eb("slug", "=", ref)]) : eb("slug", "=", ref)))
    .executeTakeFirst();
  return row?.id ?? null;
}

/** A qué tienda (y, si viene el listing, a qué oferta y producto) fue el clic; null si no se puede saber. */
export async function resolveClick(db: Db, input: RecordClickRequest) {
  const listingId = numericId(input.listing_id);
  const listing = listingId
    ? await db.query
        .selectFrom("listings")
        .select(["id", "store_id", "product_id"])
        .where("id", "=", listingId)
        .executeTakeFirst()
    : undefined;
  const storeId = listing?.store_id ?? (await findStoreId(db, input.store_id));
  if (!storeId) return null;
  return { storeId, listingId: listing?.id ?? null, productId: listing?.product_id ?? null };
}
