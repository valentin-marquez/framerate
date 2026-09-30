import type { Db } from "@framerate/database";
import { compare, decide } from "./domain/decide";
import type { Fingerprint } from "./domain/fingerprint";
import { productNameFromTitle } from "./domain/product-name";
import {
  attachIdentifiers,
  createProduct,
  createReview,
  fillProductImage,
  findCandidates,
  loadCandidates,
  setListingProduct,
} from "./repository";

/**
 * Lo mínimo que el matching necesita saber de una oferta. La oferta normalizada
 * de la ingesta lo cumple estructuralmente: así este paquete no depende de ella.
 */
export interface MatchableOffer {
  title: string;
  imageUrl: string | null;
  fingerprint: Fingerprint;
}

export type MatchOutcome = "kept" | "linked" | "new_product" | "review";

export interface MatchListingInput {
  listingId: number;
  /** Producto actual de la oferta (si ya estaba vinculada). */
  currentProductId: number | null;
  offer: MatchableOffer;
  now: string;
  decidedBy?: string;
}

/**
 * Vincula una oferta a un producto canónico.
 *
 * 1. Si ya estaba vinculada, verifica que el vínculo siga siendo válido
 *    (la tienda pudo corregir el título o el MPN). Si ahora hay un veto,
 *    la desvincula (queda auditado) y vuelve a decidir.
 * 2. Busca candidatos y decide: vincular, producto nuevo, o producto nuevo
 *    + revisión humana (la oferta queda visible mientras se revisa).
 */
export async function matchListing(
  db: Db,
  input: MatchListingInput,
): Promise<{ outcome: MatchOutcome; unlinked: boolean }> {
  const { offer, listingId, now } = input;
  const decidedBy = input.decidedBy ?? "system";
  const fp = offer.fingerprint;
  let unlinked = false;

  if (input.currentProductId !== null) {
    const [current] = await loadCandidates(db, [input.currentProductId], fp);
    const check = current ? compare(fp, current.fingerprint) : null;
    if (check && check.vetoes.length === 0) return { outcome: "kept", unlinked };
    await setListingProduct(db, {
      listingId,
      productId: null,
      method: "unlinked",
      confidence: 1,
      evidence: { previousProductId: input.currentProductId, vetoes: check?.vetoes ?? ["product_missing"] },
      decidedBy,
      now,
    });
    unlinked = true;
  }

  const decision = decide(fp, await findCandidates(db, fp));

  if (decision.kind === "link") {
    await setListingProduct(db, {
      listingId,
      productId: decision.productId,
      method: decision.method,
      confidence: decision.confidence,
      evidence: { ...decision.comparison.evidence },
      decidedBy,
      now,
    });
    // Enriquecer el producto: identificadores nuevos permiten matchear por id en el futuro.
    await attachIdentifiers(db, decision.productId, fp);
    await fillProductImage(db, decision.productId, offer.imageUrl, now);
    return { outcome: "linked", unlinked };
  }

  const product = await createProduct(db, {
    name: productNameFromTitle(offer.title),
    fingerprint: fp,
    imageUrl: offer.imageUrl,
    now,
  });
  await setListingProduct(db, {
    listingId,
    productId: product.id,
    method: "new_product",
    confidence: 1,
    evidence: product.identifierConflicts.length > 0 ? { identifierConflicts: product.identifierConflicts } : {},
    decidedBy,
    now,
  });

  if (decision.kind === "review") {
    await createReview(db, {
      listingId,
      candidateProductId: decision.productId,
      score: decision.confidence,
      evidence: { ...decision.comparison.evidence },
      now,
    });
    return { outcome: "review", unlinked };
  }
  return { outcome: "new_product", unlinked };
}
