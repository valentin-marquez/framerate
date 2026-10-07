import type { Db } from "@framerate/database";
import { compare, type Decision, decide } from "./domain/decide";
import type { Fingerprint } from "./domain/fingerprint";
import { productNameFromTitle } from "./domain/product-name";
import {
  applyOverrides,
  attachIdentifiers,
  closeObsoleteReview,
  createProduct,
  createReview,
  detachIdentifiers,
  fillProductImage,
  findCandidates,
  identifierOwners,
  loadCandidates,
  loadLinkState,
  markSameStore,
  overrideKind,
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

export interface MatchListingResult {
  outcome: MatchOutcome;
  unlinked: boolean;
  categoryMismatch?: boolean;
  reviewClosed?: "accepted" | "rejected";
}

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
 *    identificadores que aportó ella misma). Si no, se desvincula (queda auditado), se le quitan al producto sólo los
 *    identificadores que ninguna otra de sus ofertas publica y se vuelve a decidir. Excepciones: una decisión manual
 *    no se toca; la fundadora (`new_product`) no se re-decide; si la categoría difiere, el vínculo se mantiene y se
 *    avisa (`categoryMismatch`). Aunque el vínculo siga válido, si su producto no la reconoce por identificador y otro
 *    dueño de su MPN o GTIN la vincularía, se muda allá.
 *    Un `force` mantiene el vínculo pase lo que pase; un `forbid` lo rompe y el producto no vuelve a ser candidato.
 *    Antes de todo, la revisión pendiente que ya no tiene nada que decidir se cierra.
 * 2. Busca candidatos y decide: vincular, producto nuevo, o producto nuevo
 *    + revisión humana (la oferta queda visible mientras se revisa).
 */
export async function matchListing(db: Db, input: MatchListingInput): Promise<MatchListingResult> {
  const { offer, listingId, now } = input;
  const decidedBy = input.decidedBy ?? "system";
  const fp = offer.fingerprint;
  // Antes que todo: una revisión vieja cerrada deja lugar a la que pueda crear esta misma llamada.
  const reviewClosed = (await closeObsoleteReview(db, listingId, fp, now)) ?? undefined;
  let unlinked = false;
  let moveTo: Decision | null = null;

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
      return { outcome: "kept", unlinked, categoryMismatch: true, reviewClosed };
    }
    const override = await overrideKind(db, listingId, productId);
    if (override === "force") return { outcome: "kept", unlinked, reviewClosed };
    if (link.method === "manual" && override !== "forbid") return { outcome: "kept", unlinked, reviewClosed };
    const check = current && compare(fp, current.fingerprint);
    const vetoes = override === "forbid" ? ["forbidden"] : check ? check.vetoes : ["product_missing"];
    let evidence: Record<string, unknown> = { previousProductId: productId, vetoes };
    if (check && vetoes.length === 0) {
      const again = link.method === "new_product" ? null : decide(fp, [{ ...current, sameStore: link.olderSameStore }]);
      if (again && again.kind !== "link") {
        evidence = { ...evidence, redecided: again.kind, score: check.score, sameStore: link.olderSameStore };
      } else {
        moveTo = check.evidence.identifier ? null : await ownerThatLinks(db, listingId, fp, productId);
        if (!moveTo) return { outcome: "kept", unlinked, reviewClosed };
        evidence = { ...evidence, identifierOwner: moveTo.productId };
      }
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

  // Sin re-decidir: contra su propio producto la fundadora puntúa 1 por atributos y le ganaría al identificador.
  const decision =
    moveTo ??
    decide(
      fp,
      await applyOverrides(db, listingId, fp, await markSameStore(db, listingId, await findCandidates(db, fp))),
    );

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
    return { outcome: "linked", unlinked, reviewClosed };
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
    return { outcome: "review", unlinked, reviewClosed };
  }
  return { outcome: "new_product", unlinked, reviewClosed };
}

/**
 * Otro producto es dueño de un identificador de la oferta y hoy la vincularía por identificador (sin veto ni
 * `forbid`). Sin esto, la fundadora de un duplicado y la que llegó por atributos se quedan aunque el veto que las
 * separó ya no exista.
 */
async function ownerThatLinks(db: Db, listingId: number, fp: Fingerprint, productId: number) {
  const owners = await identifierOwners(db, fp, productId);
  if (owners.length === 0) return null;
  const candidates = await markSameStore(db, listingId, await loadCandidates(db, owners, fp));
  const decision = decide(fp, await applyOverrides(db, listingId, fp, candidates));
  return decision.kind === "link" && decision.method === "identifier" ? decision : null;
}
