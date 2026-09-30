import type { Db } from "@/shared/db/client";
import { AppError } from "@/shared/http/errors";
import {
  attachIdentifiers,
  getListingIdentity,
  getReview,
  moveIdentifiers,
  resolveReview,
  setListingProduct,
} from "./matching.repository";

/**
 * Resolución humana de una revisión de matching.
 *  - accept: la oferta pasa al producto candidato (y le aporta sus identificadores).
 *    El producto provisional queda sin ofertas y deja de mostrarse solo.
 *  - reject: la oferta se queda en su producto propio.
 */
export async function resolveMatchReview(
  db: Db,
  input: { reviewId: number; action: "accept" | "reject"; decidedBy: string; now: string },
) {
  const review = await getReview(db, input.reviewId);
  if (!review) throw new AppError(404, "review_not_found", "La revisión no existe");
  if (review.status !== "pending") throw new AppError(409, "review_already_resolved", "La revisión ya fue resuelta");

  if (input.action === "accept") {
    const listing = await getListingIdentity(db, review.listing_id);
    if (!listing) throw new AppError(404, "listing_not_found", "La oferta ya no existe");
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
  }

  await resolveReview(db, review.id, input.action === "accept" ? "accepted" : "rejected", input.now);
}
