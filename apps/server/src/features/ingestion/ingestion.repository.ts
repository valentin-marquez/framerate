import type { Category } from "@framerate/contracts";
import { and, count, desc, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { crawlRuns, listings, pricePoints, quarantine, stores } from "@/shared/db/schema";
import type { NormalizedOffer } from "./domain/normalize";

/**
 * Acceso a datos de la ingesta. Todas las escrituras son idempotentes: si una
 * corrida se corta a la mitad y la cola la reintenta, el resultado es el mismo.
 */

export interface CrawlStats {
  seen: number;
  valid: number;
  quarantined: number;
  duplicates: number;
  created: number;
  updated: number;
  priceChanges: number;
  deactivated: number;
  linked: number;
  newProducts: number;
  reviews: number;
  unlinked: number;
  /** true si se omitió desactivar ofertas no vistas porque la corrida parecía incompleta. */
  deactivationSkipped: boolean;
}

export const emptyStats = (): CrawlStats => ({
  seen: 0,
  valid: 0,
  quarantined: 0,
  duplicates: 0,
  created: 0,
  updated: 0,
  priceChanges: 0,
  deactivated: 0,
  linked: 0,
  newProducts: 0,
  reviews: 0,
  unlinked: 0,
  deactivationSkipped: false,
});

export async function ensureStore(db: Db, store: { slug: string; name: string; url: string }, now: string) {
  const row = await db
    .insert(stores)
    .values({ ...store, createdAt: now })
    .onConflictDoUpdate({ target: stores.slug, set: { name: store.name, url: store.url } })
    .returning({ id: stores.id, isActive: stores.isActive })
    .get();
  return row;
}

export async function startRun(db: Db, run: { id: string; storeId: number; category: Category; now: string }) {
  await db.insert(crawlRuns).values({
    id: run.id,
    storeId: run.storeId,
    category: run.category,
    status: "running",
    startedAt: run.now,
  });
}

export async function finishRun(
  db: Db,
  runId: string,
  result: { status: "succeeded" | "failed"; stats: CrawlStats; error?: string; now: string },
) {
  await db
    .update(crawlRuns)
    .set({
      status: result.status,
      stats: { ...result.stats },
      error: result.error ?? null,
      finishedAt: result.now,
    })
    .where(eq(crawlRuns.id, runId));
}

export async function addToQuarantine(
  db: Db,
  entry: { runId: string; storeId: number; externalId: string | null; reason: string; payload: unknown; now: string },
) {
  await db.insert(quarantine).values({
    runId: entry.runId,
    storeId: entry.storeId,
    externalId: entry.externalId,
    reason: entry.reason,
    payload: entry.payload ?? null,
    createdAt: entry.now,
  });
}

export interface UpsertResult {
  listingId: number;
  created: boolean;
  priceChanged: boolean;
  /** Producto al que estaba vinculada antes de esta actualización. */
  productId: number | null;
  /** Cambió algo que afecta el matching (título, marca, identificadores). */
  identityChanged: boolean;
}

/**
 * Inserta o actualiza una oferta. Registra un punto de precio SÓLO si cambió
 * precio o disponibilidad (o si es nueva). Oferta + punto de precio se
 * escriben en un mismo batch (atómico en D1).
 */
export async function upsertListing(
  db: Db,
  storeId: number,
  offer: NormalizedOffer,
  now: string,
): Promise<UpsertResult> {
  const existing = await db
    .select()
    .from(listings)
    .where(and(eq(listings.storeId, storeId), eq(listings.externalId, offer.externalId)))
    .get();

  const fields = {
    url: offer.url,
    title: offer.title,
    category: offer.category,
    brand: offer.brand,
    mpn: offer.mpn,
    gtin: offer.gtin,
    imageUrl: offer.imageUrl,
    attributes: offer.attributes,
    priceCash: offer.priceCash,
    priceCard: offer.priceCard,
    inStock: offer.inStock,
    stockQuantity: offer.stockQuantity,
    isActive: true,
    lastSeenAt: now,
    updatedAt: now,
  };

  if (!existing) {
    await db.batch([
      db.insert(listings).values({ storeId, externalId: offer.externalId, firstSeenAt: now, ...fields }),
      // INSERT … SELECT: el punto de precio toma el id de la oferta recién insertada en el mismo batch.
      db
        .insert(pricePoints)
        .select(
          db
            .select({
              id: sql<number>`null`.as("id"),
              listingId: listings.id,
              priceCash: sql<number>`${offer.priceCash}`.as("price_cash"),
              priceCard: sql<number>`${offer.priceCard}`.as("price_card"),
              inStock: sql<boolean>`${offer.inStock ? 1 : 0}`.as("in_stock"),
              observedAt: sql<string>`${now}`.as("observed_at"),
            })
            .from(listings)
            .where(and(eq(listings.storeId, storeId), eq(listings.externalId, offer.externalId))),
        ),
    ]);
    const inserted = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.storeId, storeId), eq(listings.externalId, offer.externalId)))
      .get();
    if (!inserted) throw new Error(`No se pudo leer la oferta recién insertada ${storeId}/${offer.externalId}`);
    return { listingId: inserted.id, created: true, priceChanged: true, productId: null, identityChanged: true };
  }

  // Una oferta que vuelve a aparecer tras estar inactiva también es un cambio observable.
  const priceChanged =
    existing.priceCash !== offer.priceCash ||
    existing.priceCard !== offer.priceCard ||
    existing.inStock !== offer.inStock ||
    !existing.isActive;
  const identityChanged =
    existing.title !== offer.title ||
    existing.brand !== offer.brand ||
    existing.mpn !== offer.mpn ||
    existing.gtin !== offer.gtin ||
    existing.productId === null;

  const update = db.update(listings).set(fields).where(eq(listings.id, existing.id));
  if (priceChanged) {
    await db.batch([
      update,
      db.insert(pricePoints).values({
        listingId: existing.id,
        priceCash: offer.priceCash,
        priceCard: offer.priceCard,
        inStock: offer.inStock,
        observedAt: now,
      }),
    ]);
  } else {
    await update;
  }
  return { listingId: existing.id, created: false, priceChanged, productId: existing.productId, identityChanged };
}

export async function countActiveListings(db: Db, storeId: number, category: Category): Promise<number> {
  const row = await db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.storeId, storeId), eq(listings.category, category), eq(listings.isActive, true)))
    .get();
  return row?.n ?? 0;
}

/** Marca como inactivas las ofertas que la tienda ya no publica (no vistas en esta corrida). */
export async function deactivateUnseen(db: Db, storeId: number, category: Category, runStartedAt: string, now: string) {
  const rows = await db
    .update(listings)
    .set({ isActive: false, updatedAt: now })
    .where(
      and(
        eq(listings.storeId, storeId),
        eq(listings.category, category),
        eq(listings.isActive, true),
        lt(listings.lastSeenAt, runStartedAt),
      ),
    )
    .returning({ id: listings.id });
  return rows.length;
}

export async function listRuns(db: Db, limit: number) {
  return db
    .select({
      id: crawlRuns.id,
      store: stores.slug,
      category: crawlRuns.category,
      status: crawlRuns.status,
      startedAt: crawlRuns.startedAt,
      finishedAt: crawlRuns.finishedAt,
      stats: crawlRuns.stats,
      error: crawlRuns.error,
    })
    .from(crawlRuns)
    .innerJoin(stores, eq(stores.id, crawlRuns.storeId))
    .orderBy(desc(crawlRuns.startedAt))
    .limit(limit);
}

export async function listQuarantine(db: Db, filter: { runId?: string; limit: number }) {
  return db
    .select({
      id: quarantine.id,
      runId: quarantine.runId,
      store: stores.slug,
      externalId: quarantine.externalId,
      reason: quarantine.reason,
      payload: quarantine.payload,
      createdAt: quarantine.createdAt,
    })
    .from(quarantine)
    .innerJoin(stores, eq(stores.id, quarantine.storeId))
    .where(filter.runId ? eq(quarantine.runId, filter.runId) : undefined)
    .orderBy(desc(quarantine.id))
    .limit(filter.limit);
}
