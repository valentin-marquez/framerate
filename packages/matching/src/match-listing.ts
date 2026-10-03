import type { Db } from "@framerate/database";
import { compare, decide } from "./domain/decide";
import type { Fingerprint } from "./domain/fingerprint";
import { productNameFromTitle } from "./domain/product-name";
import {
  attachIdentifiers,
  createProduct,
  createReview,
  detachIdentifiers,
  fillProductImage,
  findCandidates,
  loadCandidates,
  loadLinkState,
  markSameStore,
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
 * 1. Si ya estaba vinculada, el vínculo sigue sólo si `decide` lo haría hoy (sin veto y sin contar los
 *    identificadores que aportó ella misma). Si no, se desvincula (queda auditado), se le quitan al producto los
 *    identificadores de la oferta y se vuelve a decidir.
 * 2. Busca candidatos y decide: vincular, producto nuevo, o producto nuevo
 *    + revisión humana (la oferta queda visible mientras se revisa).
 */
export async function matchListing(
  db: Db,
  input: MatchListingInput,
): Promise<{ outcome: MatchOutcome; unlinked: boolean; categoryMismatch?: boolean }> {
  const { offer, listingId, now } = input;
  const decidedBy = input.decidedBy ?? "system";
  const fp = offer.fingerprint;
  let unlinked = false;

  if (input.currentProductId !== null) {
    const productId = input.currentProductId;
    const link = await loadLinkState(db, listingId, productId);
    // Los identificadores que sólo aporta esta oferta no cuentan: si no, el vínculo se confirmaría solo.
    const ownOnly = {
      mpn: fp.mpn && !link.others.some((o) => o.mpn === fp.mpn) ? fp.mpn : null,
      gtin: fp.gtin && !link.others.some((o) => o.gtin === fp.gtin) ? fp.gtin : null,
    };
    const [current] = await loadCandidates(db, [productId], fp, ownOnly);
    // La tienda publica la misma oferta en dos categorías: re-decidir la sacaría del producto en cada corrida.
    if (current && current.fingerprint.category !== fp.category) {
      return { outcome: "kept", unlinked, categoryMismatch: true };
    }
    if (link.method === "manual") return { outcome: "kept", unlinked };
    const check = current && compare(fp, current.fingerprint);
    const vetoes = check ? check.vetoes : ["product_missing"];
    let evidence: Record<string, unknown> = { previousProductId: productId, vetoes };
    if (current && check && vetoes.length === 0) {
      if (link.method === "new_product") return { outcome: "kept", unlinked };
      const again = decide(fp, [{ ...current, sameStore: link.olderSameStore }]);
      if (again.kind === "link") return { outcome: "kept", unlinked };
      evidence = { ...evidence, redecided: again.kind, score: check.score, sameStore: link.olderSameStore };
    }
    await setListingProduct(db, {
      listingId,
      productId: null,
      method: "unlinked",
      confidence: 1,
      evidence,
      decidedBy,
      now,
    });
    await detachIdentifiers(db, productId, fp);
    unlinked = true;
  }

  const decision = decide(fp, await markSameStore(db, listingId, await findCandidates(db, fp)));

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
