import { CATEGORIES, type Category, type ListingIdentity, type PipelineMessage } from "@framerate/contracts";
import { type Db, parseJson, refreshProductsPriceSummary, toJson } from "@framerate/database";
import type { Logger } from "@framerate/kit";
import {
  applyOverrides,
  compare,
  decide,
  findCandidates,
  fingerprintFromIdentity,
  loadCandidates,
  markSameStore,
  matchListing,
  mergeSplitIdentity,
  publishListing,
} from "@framerate/matching";

/**
 * Vínculo desde la identidad del normalizador (spec 2026-10-08 §5 y §8, #153). Consume `framerate-link` en serie:
 * dos ofertas del mismo producto nuevo en paralelo crearían dos productos.
 *  - shadow: qué haría `decide` con la huella de la identidad, contra el vínculo actual, en `match_shadow`.
 *  - live:   vincula de verdad; el producto nuevo toma el nombre canónico y se publica si no queda revisión.
 * `backfill` sólo escribe sombra en cualquier modo; `relink` firma `relink:v1`. El producto que el preprocesador
 * reconoció entre los candidatos del catálogo (`same_as`, #157) es la decisión principal; lo que vio y no eligió no
 * se vincula solo por atributos.
 */
export type LinkMode = "off" | "shadow" | "live";

export const linkModeOf = (value: string | undefined): LinkMode =>
  value === "off" || value === "live" ? value : "shadow";

export type LinkResult = "skipped" | "off" | "shadow" | "kept" | "linked" | "new_product" | "review";

export async function linkListing(
  db: Db,
  message: PipelineMessage,
  mode: LinkMode,
  now: Date,
  log: Logger,
): Promise<LinkResult> {
  if (mode === "off") return "off";
  const listing = await db.query
    .selectFrom("listings")
    .select(["id", "product_id", "category", "title", "brand", "mpn", "gtin", "image_url", "is_active"])
    .where("id", "=", message.listingId)
    .executeTakeFirst();
  // Desapareció antes de normalizarse: `deactivateUnseen` ya la apagó y no hay nada que vincular.
  if (!listing || listing.is_active === 0) return "skipped";
  const row = await db.query
    .selectFrom("listing_identity")
    .select(["category", "brand", "name", "mpn", "confidence", "identity", "same_as", "identity_raw"])
    .where("listing_id", "=", listing.id)
    .where("version", "=", message.version)
    .executeTakeFirst();
  if (!row || !(CATEGORIES as readonly string[]).includes(row.category)) {
    log.warn("link.no_identity", { listingId: listing.id, version: message.version });
    return "skipped";
  }
  const identity: ListingIdentity = {
    category: row.category as Category,
    brand: row.brand,
    name: row.name,
    mpn: row.mpn,
    confidence: row.confidence,
    identity: parseJson(row.identity, {}),
  };
  const fp = fingerprintFromIdentity({ identity, mpn: listing.mpn, gtin: listing.gtin });
  const at = now.toISOString();

  if (mode === "shadow" || message.reason === "backfill") {
    const decision = decide(
      fp,
      await applyOverrides(db, listing.id, fp, await markSameStore(db, listing.id, await findCandidates(db, fp))),
    );
    const [current] = listing.product_id === null ? [] : await loadCandidates(db, [listing.product_id], fp);
    const productId = decision.kind === "new_product" ? null : decision.productId;
    const agrees =
      decision.kind === "link"
        ? productId === listing.product_id
        : decision.kind === "new_product" && listing.product_id === null;
    const shadow = {
      kind: decision.kind,
      product_id: productId,
      score: decision.kind === "new_product" ? 0 : decision.comparison.score,
      vetoes: toJson(current ? compare(fp, current.fingerprint).vetoes : []),
      current_product_id: listing.product_id,
      agrees: agrees ? (1 as const) : (0 as const),
      created_at: at,
    };
    await db.query
      .insertInto("match_shadow")
      .values({ listing_id: listing.id, version: message.version, ...shadow })
      .onConflict((oc) => oc.columns(["listing_id", "version"]).doUpdateSet(shadow))
      .execute();
    log.info("link.shadow", { listingId: listing.id, reason: message.reason, ...shadow });
    return "shadow";
  }

  const decidedBy = message.reason === "relink" ? "relink:v1" : "system";
  const result = await matchListing(db, {
    listingId: listing.id,
    currentProductId: listing.product_id,
    offer: { title: listing.title, imageUrl: listing.image_url, fingerprint: fp },
    canonicalName: identity.name,
    decidedBy,
    now: at,
    sameAs: row.same_as,
    shownCandidates: parseJson<{ candidates?: number[] }>(row.identity_raw, {}).candidates ?? [],
  });
  const merge = await mergeSplitIdentity(db, { listingId: listing.id, fingerprint: fp, decidedBy, now: at });
  await db.query.updateTable("listings").set({ norm_status: "linked" }).where("id", "=", listing.id).execute();
  // Con revisión pendiente la oferta sigue oculta: la publica `resolveMatchReview` o el plazo de 24 h.
  const published = result.outcome === "review" ? false : await publishListing(db, listing.id, at);
  await refreshTouched(db, listing.id, listing.product_id, now);
  log.info("link.decided", {
    listingId: listing.id,
    reason: message.reason,
    outcome: result.outcome,
    unlinked: result.unlinked,
    sameAs: row.same_as,
    published,
    merge: merge?.status ?? null,
  });
  return result.outcome;
}

const HIDDEN_MAX_MS = 24 * 60 * 60 * 1000;
// ponytail: 100 por corrida del Cron (cada 6 h); sube si se acumulan revisiones sin resolver.
const OVERDUE_BATCH = 100;

/**
 * Plazo de publicación (spec §8): una oferta vinculada y oculta más de 24 h (revisión pendiente sin resolver) sale
 * igual. Lo que lleva 24 h sin vínculo no se toca: no hay huella por regex de respaldo (#156), el Cron de ingest lo
 * reencola a Haiku.
 */
export async function publishOverdue(db: Db, now: Date, log: Logger) {
  const at = now.toISOString();
  const rows = await db.query
    .selectFrom("listings")
    .select(["id", "product_id"])
    .where("visible", "=", 0)
    .where("is_active", "=", 1)
    .where("product_id", "is not", null)
    .where("first_seen_at", "<", new Date(now.getTime() - HIDDEN_MAX_MS).toISOString())
    .orderBy("id")
    .limit(OVERDUE_BATCH)
    .execute();
  for (const l of rows) {
    await publishListing(db, l.id, at);
    await refreshTouched(db, l.id, l.product_id, now);
    log.info("link.overdue_published", { listingId: l.id, productId: l.product_id });
  }
  return { published: rows.length };
}

/** Precio y versión del catálogo de los productos que la oferta dejó o ganó (el vínculo corre fuera de la corrida). */
async function refreshTouched(db: Db, listingId: number, previousProductId: number | null, now: Date) {
  const after = await db.query
    .selectFrom("listings")
    .select("product_id")
    .where("id", "=", listingId)
    .executeTakeFirst();
  const ids = new Set([previousProductId, after?.product_id ?? null].filter((id) => id !== null));
  if (ids.size > 0) await refreshProductsPriceSummary(db, ids, now);
}
