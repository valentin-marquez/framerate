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
  fillProductAttributes,
  fillProductImage,
  findCandidates,
  identifierOwners,
  loadCandidates,
  loadLinkState,
  markSameStore,
  overrideKind,
  pruneStaleIdentifiers,
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
  /**
   * Oferta con identidad del normalizador: un producto nuevo toma este nombre canónico y, al vincular, la huella de
   * la oferta completa la del producto (spec §5.2 y §5.3). Sin él, el camino de hoy: título limpio y nada se completa.
   */
  canonicalName?: string;
  /**
   * Producto que el preprocesador reconoció como el mismo SKU entre los candidatos del catálogo (#157). Es la decisión
   * principal: vincula salvo que `compare` dé un veto o un conflicto de MPN o de código de modelo.
   */
  sameAs?: number | null;
  /** Candidatos que vio el preprocesador: lo que vio y no eligió no se vincula solo por atributos. */
  shownCandidates?: number[];
}

/**
 * Vincula una oferta a un producto canónico.
 *
 * 1. Si ya estaba vinculada (con identidad de Haiku), el vínculo sigue mientras nada lo vete; si el texto libre
 *    difiere, el producto tiene otra oferta más antigua de la misma tienda o la huella viene del regex, sólo si
 *    `decide` lo haría hoy (sin contar los identificadores que aportó ella misma) o el preprocesador la reconoció. Si no, se desvincula (queda auditado), se le quitan al producto sólo los
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
  let movedBySameAs = false;

  if (input.currentProductId !== null) {
    const productId = input.currentProductId;
    // Un vínculo que se queda también entrega al producto los códigos que la oferta empezó a publicar (#103).
    const keep = async () => {
      await attachIdentifiers(db, productId, fp);
      return { outcome: "kept" as const, unlinked, reviewClosed };
    };
    // Antes de comparar: un MPN que la tienda ya cambió no puede dar conflicto contra la propia oferta (#99).
    await pruneStaleIdentifiers(db, productId);
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
    if (override === "force") return keep();
    if (link.method === "manual" && override !== "forbid") return keep();
    const check = current && compare(fp, current.fingerprint);
    const vetoes = override === "forbid" ? ["forbidden"] : check ? check.vetoes : ["product_missing"];
    let evidence: Record<string, unknown> = { previousProductId: productId, vetoes };
    if (check && vetoes.length === 0) {
      if (input.canonicalName) {
        // Con identidad de Haiku el vínculo se queda mientras nada lo vete: un título editado no lo rompe. Sólo se
        // mueve si el preprocesador reconoció otra ficha (`same_as`) y la guarda lo deja, o si Haiku no reconoció
        // ninguna y otro producto es dueño de su identificador.
        if (input.sameAs && input.sameAs !== productId) {
          moveTo = await sameAsLink(db, listingId, fp, input.sameAs);
          movedBySameAs = moveTo !== null;
          if (moveTo) evidence = { ...evidence, redecided: "same_as", sameAs: input.sameAs };
        } else if (!input.sameAs && !check.evidence.identifier) {
          moveTo = await ownerThatLinks(db, listingId, fp, productId);
          if (moveTo) evidence = { ...evidence, identifierOwner: moveTo.productId };
        }
        if (!moveTo) return keep();
      } else {
        // Por regex (`legacy`, `fallback`) se re-decide siempre, como antes.
        const again =
          link.method === "new_product" ? null : decide(fp, [{ ...current, sameStore: link.olderSameStore }]);
        if (again && again.kind !== "link") {
          evidence = { ...evidence, redecided: again.kind, score: check.score, sameStore: link.olderSameStore };
        } else {
          moveTo = check.evidence.identifier ? null : await ownerThatLinks(db, listingId, fp, productId);
          if (!moveTo) return keep();
          evidence = { ...evidence, identifierOwner: moveTo.productId };
        }
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

  // Haiku primero: el producto que reconoció vincula si la guarda lo deja. Después, `decide` con las reglas; pero si
  // Haiku vio ese producto entre los candidatos y no lo eligió, el vínculo por atributos pasa a revisión (la decide el
  // juez), y sólo un identificador vincula igual.
  let viaSameAs = movedBySameAs;
  let decision: Decision | null = moveTo;
  if (!decision && input.sameAs) {
    decision = await sameAsLink(db, listingId, fp, input.sameAs);
    viaSameAs = decision !== null;
  }
  if (!decision) {
    // Sin re-decidir: contra su propio producto la fundadora puntúa 1 por atributos y le ganaría al identificador.
    decision = decide(
      fp,
      await applyOverrides(db, listingId, fp, await markSameStore(db, listingId, await findCandidates(db, fp))),
    );
    const shown = decision.kind !== "new_product" && input.shownCandidates?.includes(decision.productId);
    // Haiku vio ese candidato con otra línea o modelo y no lo eligió: no hay nada que revisar.
    if (input.canonicalName && shown && decision.kind === "review" && decision.comparison.evidence.textMismatch) {
      decision = { kind: "new_product" };
    }
    if (input.canonicalName && shown && decision.kind === "link" && decision.method === "attributes") {
      decision = {
        kind: "review",
        productId: decision.productId,
        confidence: decision.confidence,
        comparison: decision.comparison,
      };
    }
  }

  if (decision.kind === "link") {
    await setListingProduct(db, {
      listingId,
      productId: decision.productId,
      method: decision.method,
      confidence: decision.confidence,
      evidence: { ...decision.comparison.evidence, ...(viaSameAs ? { sameAs: true } : {}) },
      decidedBy,
      now,
    });
    // Enriquecer el producto: identificadores nuevos permiten matchear por id en el futuro.
    await attachIdentifiers(db, decision.productId, fp);
    if (input.canonicalName) await fillProductAttributes(db, decision.productId, fp, now);
    await fillProductImage(db, decision.productId, offer.imageUrl, now);
    return { outcome: "linked", unlinked, reviewClosed };
  }

  const product = await createProduct(db, {
    name: input.canonicalName ?? productNameFromTitle(offer.title),
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

/**
 * El `same_as` del preprocesador vincula salvo que lo contradiga un dato estructural (veto), un MPN o código de modelo
 * distinto, o un `forbid`. Que la tienda ya tenga otra oferta ahí no lo frena: Haiku juzgó con el título completo.
 */
async function sameAsLink(db: Db, listingId: number, fp: Fingerprint, productId: number): Promise<Decision | null> {
  const [candidate] = await applyOverrides(db, listingId, fp, await loadCandidates(db, [productId], fp));
  if (!candidate || candidate.override === "forbid") return null;
  const comparison = compare(fp, candidate.fingerprint);
  const { vetoes, evidence } = comparison;
  if (vetoes.length > 0 || evidence.mpnConflict || evidence.modelConflict) return null;
  return { kind: "link", productId, method: "attributes", confidence: comparison.score, comparison };
}
