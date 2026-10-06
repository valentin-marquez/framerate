import type { Db } from "@framerate/database";
import { resolveMatchReview as resolve, splitListing as split } from "@framerate/matching";
import { AppError } from "@/shared/http/errors";

/** Resolución humana de una revisión de matching (Gatekeeper); la lógica vive en `@framerate/matching`. */
export async function resolveMatchReview(
  db: Db,
  input: { reviewId: number; action: "accept" | "reject"; decidedBy: string; now: string },
) {
  const result = await resolve(db, input);
  switch (result.status) {
    case "not_found":
      throw new AppError(404, "review_not_found", "La revisión no existe");
    case "already_resolved":
      throw new AppError(409, "review_already_resolved", "La revisión ya fue resuelta");
    case "listing_missing":
      throw new AppError(404, "listing_not_found", "La oferta ya no existe");
    case "vetoed":
      throw new AppError(
        409,
        "review_vetoed",
        `El matching dice que son productos distintos (${result.vetoes.join(", ")})`,
      );
  }
}

export async function splitListing(db: Db, input: { listingId: number; decidedBy: string; now: string }) {
  const result = await split(db, input);
  switch (result.status) {
    case "not_found":
      throw new AppError(404, "listing_not_found", "La oferta no existe");
    case "not_linked":
      throw new AppError(409, "listing_not_linked", "La oferta no está vinculada a ningún producto");
    case "split":
      return { productId: result.productId, created: result.created };
  }
}
