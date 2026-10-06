import type { Category } from "@framerate/contracts";
import { bumpCatalogVersion, type Db } from "@framerate/database";
import { compare } from "./domain/decide";
import { buildFingerprint } from "./domain/fingerprint";
import {
  addOverride,
  attachIdentifiers,
  getListingIdentity,
  getReview,
  loadCandidates,
  moveIdentifiers,
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

  if (input.action === "accept") {
    const listing = await getListingIdentity(db, review.listing_id);
    if (!listing) return { status: "listing_missing" };
    const fp = buildFingerprint({
      category: listing.category as Category,
      title: listing.title,
      brand: listing.brand,
      mpn: listing.mpn,
      gtin: listing.gtin,
    });
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
    await bumpCatalogVersion(db);
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
  return { status: "resolved" };
}
