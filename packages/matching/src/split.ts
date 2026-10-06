import type { Category } from "@framerate/contracts";
import { bumpCatalogVersion, type Db, parseJson } from "@framerate/database";
import { buildFingerprint } from "./domain/fingerprint";
import { productNameFromTitle } from "./domain/product-name";
import {
  addOverride,
  attachIdentifiers,
  createProduct,
  detachIdentifiers,
  getListingIdentity,
  setListingProduct,
} from "./repository";

export type SplitResult =
  | { status: "split"; productId: number; created: boolean }
  | { status: "not_found" | "not_linked" };

/**
 * Deshace una fusión: la oferta y sus identificadores vuelven al `previousProductId` de la decisión que la movió (o a
 * un producto nuevo si ya no existe) y queda un `forbid` hacia el producto del que sale, para que el próximo crawl no
 * la junte otra vez. Es el inverso de aceptar en `resolveMatchReview`.
 */
export async function splitListing(
  db: Db,
  input: { listingId: number; decidedBy: string; now: string },
): Promise<SplitResult> {
  const listing = await getListingIdentity(db, input.listingId);
  if (!listing) return { status: "not_found" };
  const from = listing.productId;
  if (from === null) return { status: "not_linked" };

  const last = await db.query
    .selectFrom("match_decisions")
    .select("evidence")
    .where("listing_id", "=", listing.id)
    .where("product_id", "=", from)
    .orderBy("id", "desc")
    .limit(1)
    .executeTakeFirst();
  const previous = parseJson<{ previousProductId?: number | null }>(last?.evidence, {}).previousProductId;
  const existing =
    previous && previous !== from
      ? await db.query.selectFrom("products").select("id").where("id", "=", previous).executeTakeFirst()
      : undefined;

  const fp = buildFingerprint({
    category: listing.category as Category,
    title: listing.title,
    brand: listing.brand,
    mpn: listing.mpn,
    gtin: listing.gtin,
  });
  const target =
    existing?.id ??
    (
      await createProduct(db, {
        name: productNameFromTitle(listing.title),
        fingerprint: fp,
        imageUrl: listing.imageUrl,
        now: input.now,
      })
    ).id;
  await setListingProduct(db, {
    listingId: listing.id,
    productId: target,
    method: existing ? "manual" : "new_product",
    confidence: 1,
    evidence: { split: true, previousProductId: from },
    decidedBy: input.decidedBy,
    now: input.now,
  });
  // Después de mover la oferta: si no, ella misma cuenta como quien todavía publica el identificador.
  await detachIdentifiers(db, from, fp);
  await attachIdentifiers(db, target, fp);
  await addOverride(db, {
    listingId: listing.id,
    productId: from,
    kind: "forbid",
    createdBy: input.decidedBy,
    now: input.now,
  });
  await bumpCatalogVersion(db);
  return { status: "split", productId: target, created: !existing };
}

/**
 * Separa en bloque las aceptaciones de la IA (`decided_by` = `ai:<modelo>`) que siguen vigentes: la última decisión
 * de la oferta, y sigue en ese producto. Procesa hasta `limit` por llamada (D1 limita las consultas por invocación);
 * lo que queda se reporta en `remaining` y se repite la llamada.
 */
export async function revertAiDecisions(
  db: Db,
  input: { model?: string; since?: string; until?: string; limit?: number; decidedBy: string; now: string },
): Promise<{ reverted: number; remaining: number }> {
  let query = db.query
    .selectFrom("match_decisions as d")
    .innerJoin("listings as l", (join) =>
      join.onRef("l.id", "=", "d.listing_id").onRef("l.product_id", "=", "d.product_id"),
    )
    .select("d.listing_id as listingId")
    .where("d.method", "=", "manual")
    .where((eb) => (input.model ? eb("d.decided_by", "=", `ai:${input.model}`) : eb("d.decided_by", "like", "ai:%")))
    .where("d.id", "=", (eb) =>
      eb
        .selectFrom("match_decisions as last")
        .select((e) => e.fn.max("last.id").as("id"))
        .whereRef("last.listing_id", "=", "d.listing_id"),
    );
  if (input.since) query = query.where("d.created_at", ">=", input.since);
  if (input.until) query = query.where("d.created_at", "<", input.until);
  const rows = await query.execute();

  const batch = rows.slice(0, input.limit ?? 50);
  let reverted = 0;
  for (const { listingId } of batch) {
    const result = await splitListing(db, { listingId, decidedBy: input.decidedBy, now: input.now });
    if (result.status === "split") reverted++;
  }
  return { reverted, remaining: rows.length - batch.length };
}
