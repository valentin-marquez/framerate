import type { Category } from "@framerate/contracts";
import type { Db } from "@/shared/db/client";
import { fromBool, parseJson, toBool, toJson } from "@/shared/db/codecs";
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
  const row = await db.query
    .insertInto("stores")
    .values({ slug: store.slug, name: store.name, url: store.url, created_at: now })
    .onConflict((oc) => oc.column("slug").doUpdateSet({ name: store.name, url: store.url }))
    .returning(["id", "is_active"])
    .executeTakeFirstOrThrow();
  return { id: row.id, isActive: toBool(row.is_active) };
}

export async function startRun(db: Db, run: { id: string; storeId: number; category: Category; now: string }) {
  await db.query
    .insertInto("crawl_runs")
    .values({ id: run.id, store_id: run.storeId, category: run.category, status: "running", started_at: run.now })
    .execute();
}

export async function finishRun(
  db: Db,
  runId: string,
  result: { status: "succeeded" | "failed"; stats: CrawlStats; error?: string; now: string },
) {
  await db.query
    .updateTable("crawl_runs")
    .set({
      status: result.status,
      stats: toJson(result.stats),
      error: result.error ?? null,
      finished_at: result.now,
    })
    .where("id", "=", runId)
    .execute();
}

export async function addToQuarantine(
  db: Db,
  entry: { runId: string; storeId: number; externalId: string | null; reason: string; payload: unknown; now: string },
) {
  await db.query
    .insertInto("quarantine")
    .values({
      run_id: entry.runId,
      store_id: entry.storeId,
      external_id: entry.externalId,
      reason: entry.reason,
      payload: toJson(entry.payload),
      created_at: entry.now,
    })
    .execute();
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
  const existing = await db.query
    .selectFrom("listings")
    .selectAll()
    .where("store_id", "=", storeId)
    .where("external_id", "=", offer.externalId)
    .executeTakeFirst();

  const fields = {
    url: offer.url,
    title: offer.title,
    category: offer.category,
    brand: offer.brand,
    mpn: offer.mpn,
    gtin: offer.gtin,
    image_url: offer.imageUrl,
    attributes: toJson(offer.attributes),
    price_cash: offer.priceCash,
    price_card: offer.priceCard,
    in_stock: fromBool(offer.inStock),
    stock_quantity: offer.stockQuantity,
    is_active: 1 as const,
    last_seen_at: now,
    updated_at: now,
  };
  const pricePoint = {
    price_cash: offer.priceCash,
    price_card: offer.priceCard,
    in_stock: fromBool(offer.inStock),
    observed_at: now,
  };

  if (!existing) {
    await db.batch([
      db.query
        .insertInto("listings")
        .values({ store_id: storeId, external_id: offer.externalId, first_seen_at: now, ...fields }),
      // INSERT … SELECT: el punto de precio toma el id de la oferta insertada en el mismo batch.
      db.query
        .insertInto("price_points")
        .columns(["listing_id", "price_cash", "price_card", "in_stock", "observed_at"])
        .expression((eb) =>
          eb
            .selectFrom("listings")
            .select([
              "id",
              eb.val(pricePoint.price_cash).as("price_cash"),
              eb.val(pricePoint.price_card).as("price_card"),
              eb.val(pricePoint.in_stock).as("in_stock"),
              eb.val(pricePoint.observed_at).as("observed_at"),
            ])
            .where("store_id", "=", storeId)
            .where("external_id", "=", offer.externalId),
        ),
    ]);
    const inserted = await db.query
      .selectFrom("listings")
      .select("id")
      .where("store_id", "=", storeId)
      .where("external_id", "=", offer.externalId)
      .executeTakeFirstOrThrow();
    return { listingId: inserted.id, created: true, priceChanged: true, productId: null, identityChanged: true };
  }

  // Una oferta que vuelve a aparecer tras estar inactiva también es un cambio observable.
  const priceChanged =
    existing.price_cash !== offer.priceCash ||
    existing.price_card !== offer.priceCard ||
    toBool(existing.in_stock) !== offer.inStock ||
    !toBool(existing.is_active);
  const identityChanged =
    existing.title !== offer.title ||
    existing.brand !== offer.brand ||
    existing.mpn !== offer.mpn ||
    existing.gtin !== offer.gtin ||
    existing.product_id === null;

  const update = db.query.updateTable("listings").set(fields).where("id", "=", existing.id);
  await db.batch(
    priceChanged
      ? [update, db.query.insertInto("price_points").values({ listing_id: existing.id, ...pricePoint })]
      : [update],
  );
  return { listingId: existing.id, created: false, priceChanged, productId: existing.product_id, identityChanged };
}

export async function countActiveListings(db: Db, storeId: number, category: Category): Promise<number> {
  const row = await db.query
    .selectFrom("listings")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("store_id", "=", storeId)
    .where("category", "=", category)
    .where("is_active", "=", 1)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

/** Marca como inactivas las ofertas que la tienda ya no publica (no vistas en esta corrida). */
export async function deactivateUnseen(db: Db, storeId: number, category: Category, runStartedAt: string, now: string) {
  const rows = await db.query
    .updateTable("listings")
    .set({ is_active: 0, updated_at: now })
    .where("store_id", "=", storeId)
    .where("category", "=", category)
    .where("is_active", "=", 1)
    .where("last_seen_at", "<", runStartedAt)
    .returning("id")
    .execute();
  return rows.length;
}

export async function listRuns(db: Db, limit: number) {
  const rows = await db.query
    .selectFrom("crawl_runs as r")
    .innerJoin("stores as s", "s.id", "r.store_id")
    .select([
      "r.id",
      "s.slug as store",
      "r.category",
      "r.status",
      "r.started_at as startedAt",
      "r.finished_at as finishedAt",
      "r.stats",
      "r.error",
    ])
    .orderBy("r.started_at", "desc")
    .limit(limit)
    .execute();
  return rows.map((r) => ({ ...r, stats: parseJson<Partial<CrawlStats>>(r.stats, {}) }));
}

export async function listQuarantine(db: Db, filter: { runId?: string; limit: number }) {
  let query = db.query
    .selectFrom("quarantine as q")
    .innerJoin("stores as s", "s.id", "q.store_id")
    .select([
      "q.id",
      "q.run_id as runId",
      "s.slug as store",
      "q.external_id as externalId",
      "q.reason",
      "q.payload",
      "q.created_at as createdAt",
    ])
    .orderBy("q.id", "desc")
    .limit(filter.limit);
  if (filter.runId) query = query.where("q.run_id", "=", filter.runId);
  const rows = await query.execute();
  return rows.map((r) => ({ ...r, payload: parseJson<unknown>(r.payload, null) }));
}
