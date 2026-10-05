import type { Db } from "@framerate/database";
import { resolveMatchReview as resolve } from "@framerate/matching";
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
