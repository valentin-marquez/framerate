import { type Db, refreshProductsPriceSummary } from "@framerate/database";
import { compare } from "./domain/decide";
import {
  addOverride,
  attachIdentifiers,
  getListingIdentity,
  getReview,
  listingFingerprint,
  loadCandidates,
  moveIdentifiers,
  publishListing,
  resolveReview,
  setListingProduct,
} from "./repository";

export type ResolveReviewResult =
  | { status: "resolved" }
  | { status: "not_found" | "already_resolved" | "listing_missing" }
  | { status: "vetoed"; vetoes: string[] };

/**
 * Resuelve una revisión de matching (una persona en el Gatekeeper o `framerate-match`).
 *  - accept: la oferta pasa al producto candidato (y le aporta sus identificadores). El vínculo queda `manual`
 *    para que `matchListing` no lo vuelva a decidir en cada corrida. El producto provisional queda sin ofertas.
 *  - reject: la oferta se queda en su producto propio y el par queda prohibido (`forbid`) para que no se vuelva a proponer.
 */
export async function resolveMatchReview(
  db: Db,
  input: { reviewId: number; action: "accept" | "reject"; decidedBy: string; now: string },
): Promise<ResolveReviewResult> {
  const review = await getReview(db, input.reviewId);
  if (!review) return { status: "not_found" };
  if (review.status !== "pending") return { status: "already_resolved" };

  // Productos cuyo precio cambia: el candidato y, al aceptar, el que pierde la oferta; al rechazar, el suyo.
  const touched = [review.candidate_product_id];
  if (input.action === "accept") {
    const listing = await getListingIdentity(db, review.listing_id);
    if (!listing) return { status: "listing_missing" };
    const { fingerprint: fp } = await listingFingerprint(db, listing);
    const [candidate] = await loadCandidates(db, [review.candidate_product_id], fp);
    const vetoes = candidate ? compare(fp, candidate.fingerprint).vetoes : ["product_missing"];
    if (vetoes.length > 0) return { status: "vetoed", vetoes };
    await setListingProduct(db, {
      listingId: listing.id,
      productId: review.candidate_product_id,
      method: "manual",
      confidence: 1,
      evidence: { reviewId: review.id, previousProductId: listing.productId },
      decidedBy: input.decidedBy,
      now: input.now,
    });
    const identifiers = { mpn: listing.mpn, gtin: listing.gtin };
    if (listing.productId !== null) {
      await moveIdentifiers(db, listing.productId, review.candidate_product_id, identifiers);
    }
    await attachIdentifiers(db, review.candidate_product_id, identifiers);
    if (listing.productId !== null) touched.push(listing.productId);
  }

  if (input.action === "reject") {
    await addOverride(db, {
      listingId: review.listing_id,
      productId: review.candidate_product_id,
      kind: "forbid",
      createdBy: input.decidedBy,
      now: input.now,
    });
  }
  await resolveReview(db, review.id, input.action === "accept" ? "accepted" : "rejected", input.now);
  // Una oferta que nació oculta esperando esta revisión ya puede salir (spec §8); rechazar la deja en su producto.
  await publishListing(db, review.listing_id, input.now);
  // Al final: mientras la revisión estaba pendiente la oferta no contaba en el resumen (#169).
  const owner = await db.query
    .selectFrom("listings")
    .select("product_id")
    .where("id", "=", review.listing_id)
    .executeTakeFirst();
  if (owner?.product_id != null) touched.push(owner.product_id);
  await refreshProductsPriceSummary(db, new Set(touched), new Date(input.now));
  return { status: "resolved" };
}
