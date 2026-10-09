import type { Category } from "@framerate/contracts";
import type { Db, NormStatus } from "@framerate/database";
import { fromBool, toBool, toJson } from "@framerate/database";
import { sql } from "kysely";
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
  reviewsClosed: number;
  /** Productos fusionados porque una oferta traía el MPN de uno y el GTIN del otro (#141). */
  merged: number;
  /** true si se omitió desactivar ofertas no vistas porque la corrida parecía incompleta. */
  deactivationSkipped: boolean;
  /** Pipeline (#153): existentes con el mismo `norm_hash`, con hash distinto, encoladas, y rechazos nuevos. */
  reused: number;
  changed: number;
  enqueued: number;
  quarantineNew: number;
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
  reviewsClosed: 0,
  merged: 0,
  deactivationSkipped: false,
  reused: 0,
  changed: 0,
  enqueued: 0,
  quarantineNew: 0,
});

/** Dominio de la tienda sin "www." (base del reclamo por DNS). */
export function domainOf(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

export async function ensureStore(db: Db, store: { slug: string; name: string; url: string }, now: string) {
  const row = await db.query
    .insertInto("stores")
    .values({ slug: store.slug, name: store.name, url: store.url, domain: domainOf(store.url), created_at: now })
    .onConflict((oc) =>
      oc.column("slug").doUpdateSet({ name: store.name, url: store.url, domain: domainOf(store.url) }),
    )
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

/** Un rechazo que ya está registrado con el mismo hash no se repite (UNIQUE de 0022). Devuelve si se insertó. */
export async function addToQuarantine(
  db: Db,
  entry: {
    runId: string;
    storeId: number;
    externalId: string | null;
    reason: string;
    payload: unknown;
    hash: string;
    now: string;
  },
): Promise<boolean> {
  const result = await db.query
    .insertInto("quarantine")
    .orIgnore()
    .values({
      run_id: entry.runId,
      store_id: entry.storeId,
      external_id: entry.externalId,
      reason: entry.reason,
      payload: toJson(entry.payload),
      norm_hash: entry.hash,
      created_at: entry.now,
    })
    .executeTakeFirst();
  return Number(result.numInsertedOrUpdatedRows ?? 0) > 0;
}

/** Mismo plazo que los snapshots en R2: pasado eso, el rechazo ya no se puede reproducir. */
const QUARANTINE_DAYS = 14;

/** Cada corrida vuelve a registrar sus rechazos: sin purga la tabla crece sin fin. */
const STALE_HOURS = 48;
/** Más que esto de golpe es una caída nuestra (Cron, red), no de las tiendas: no se apaga nada. */
const STALE_MAX_SHARE = 0.3;

/**
 * Una tienda que deja de responder nunca corre `deactivateUnseen` (la corrida falla antes), y sus ofertas seguirían
 * publicadas con precios viejos (Tecno Saga, dominio caído el 08-10). Las que nadie vio en 48 h (8 ciclos) se apagan;
 * si la tienda vuelve, la corrida las reactiva. Devuelve los productos tocados, para recalcular su precio.
 */
export async function deactivateStale(
  db: Db,
  now: Date,
): Promise<{ deactivated: number; skipped: boolean; productIds: number[] }> {
  const before = new Date(now.getTime() - STALE_HOURS * 3_600_000).toISOString();
  const counts = await db.query
    .selectFrom("listings")
    .select([sql<number>`count(*)`.as("active"), sql<number>`coalesce(sum(last_seen_at < ${before}), 0)`.as("stale")])
    .where("is_active", "=", 1)
    .executeTakeFirstOrThrow();
  const active = Number(counts.active);
  const stale = Number(counts.stale);
  if (stale === 0) return { deactivated: 0, skipped: false, productIds: [] };
  if (stale > active * STALE_MAX_SHARE) return { deactivated: 0, skipped: true, productIds: [] };
  const rows = await db.query
    .updateTable("listings")
    .set({ is_active: 0, updated_at: now.toISOString() })
    .where("is_active", "=", 1)
    .where("last_seen_at", "<", before)
    .returning("product_id")
    .execute();
  const productIds = [...new Set(rows.map((r) => r.product_id).filter((id): id is number => id !== null))];
  return { deactivated: rows.length, skipped: false, productIds };
}

export async function purgeQuarantine(db: Db, now: Date): Promise<number> {
  const before = new Date(now.getTime() - QUARANTINE_DAYS * 86_400_000).toISOString();
  const result = await db.query.deleteFrom("quarantine").where("created_at", "<", before).executeTakeFirst();
  return Number(result.numDeletedRows);
}

export interface UpsertResult {
  listingId: number;
  created: boolean;
  priceChanged: boolean;
  /** Producto al que estaba vinculada antes de esta actualización. */
  productId: number | null;
  /** Nueva o con `norm_hash` distinto: hay que normalizarla (de nuevo). */
  changed: boolean;
  normStatus: NormStatus;
  /** Nada cambió: sólo falta `last_seen_at`, que se escribe por tanda con `touchSeen`. */
  touchOnly: boolean;
}

export interface UpsertOptions {
  hash: string;
  /** Pipeline encendido: lo nuevo o cambiado queda `pending`. */
  pending: boolean;
  /** `PIPELINE_LINK=live`: lo nuevo nace oculto hasta que el vínculo termine (spec §8). */
  hideNew: boolean;
}

/**
 * Inserta o actualiza una oferta. Si el hash no cambió sólo se tocan precio, stock y disponibilidad (y nada si
 * tampoco cambiaron: `touchOnly`). Registra un punto de precio SÓLO si cambió precio o disponibilidad (o si es
 * nueva). Oferta + punto de precio se escriben en un mismo batch (atómico en D1).
 */
export async function upsertListing(
  db: Db,
  storeId: number,
  offer: NormalizedOffer,
  now: string,
  opts: UpsertOptions,
): Promise<UpsertResult> {
  const existing = await db.query
    .selectFrom("listings")
    .selectAll()
    .where("store_id", "=", storeId)
    .where("external_id", "=", offer.externalId)
    .executeTakeFirst();

  const identityFields = {
    url: offer.url,
    title: offer.title,
    raw_title: offer.rawTitle,
    category: offer.category,
    crawl_category: offer.category,
    brand: offer.brand,
    mpn: offer.mpn,
    gtin: offer.gtin,
    image_url: offer.imageUrl,
    image_urls: toJson(offer.imageUrls),
    attributes: toJson(offer.attributes),
    source_text: offer.sourceText,
    norm_hash: opts.hash,
  };
  const priceFields = {
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
    const normStatus: NormStatus = opts.pending ? "pending" : "legacy";
    await db.batch([
      db.query.insertInto("listings").values({
        store_id: storeId,
        external_id: offer.externalId,
        first_seen_at: now,
        ...identityFields,
        ...priceFields,
        norm_status: normStatus,
        visible: opts.hideNew ? 0 : 1,
      }),
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
    return {
      listingId: inserted.id,
      created: true,
      priceChanged: true,
      productId: null,
      changed: true,
      normStatus,
      touchOnly: false,
    };
  }

  // Una oferta que vuelve a aparecer tras estar inactiva también es un cambio observable.
  const priceChanged =
    existing.price_cash !== offer.priceCash ||
    existing.price_card !== offer.priceCard ||
    toBool(existing.in_stock) !== offer.inStock ||
    !toBool(existing.is_active);
  // Una `failed` agotó sus reintentos: la siguiente corrida la vuelve a intentar.
  const changed = existing.norm_hash !== opts.hash || existing.norm_status === "failed";
  const base = { listingId: existing.id, created: false, productId: existing.product_id };
  if (!changed && !priceChanged) {
    return { ...base, priceChanged: false, changed: false, normStatus: existing.norm_status, touchOnly: true };
  }

  const normStatus: NormStatus = changed && opts.pending ? "pending" : existing.norm_status;
  const update = db.query
    .updateTable("listings")
    .set(changed ? { ...identityFields, ...priceFields, norm_status: normStatus } : priceFields)
    .where("id", "=", existing.id);
  await db.batch(
    priceChanged
      ? [update, db.query.insertInto("price_points").values({ listing_id: existing.id, ...pricePoint })]
      : [update],
  );
  return { ...base, priceChanged, changed, normStatus, touchOnly: false };
}

// D1 acepta 100 parámetros por sentencia: los ids van en tandas y las tandas en un solo batch.
const ID_CHUNK = 90;

function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK) out.push(items.slice(i, i + ID_CHUNK));
  return out;
}

/** `last_seen_at` de las ofertas sin cambios, por tanda: es lo único que `deactivateUnseen` necesita de ellas. */
export function touchSeen(db: Db, ids: readonly number[], now: string) {
  return db.batch(
    chunks(ids).map((c) => db.query.updateTable("listings").set({ last_seen_at: now }).where("id", "in", c)),
  );
}

/** `updated_at` acompaña cada cambio de `norm_status`: el server mide con él la antigüedad de lo `pending`. */
export function markPending(db: Db, ids: readonly number[], now: string) {
  return db.batch(
    chunks(ids).map((c) =>
      db.query.updateTable("listings").set({ norm_status: "pending", updated_at: now }).where("id", "in", c),
    ),
  );
}

/**
 * Ofertas activas para una etapa del pipeline: `normalize` las que no tienen identidad de la versión actual para su
 * hash actual (ni están ya encoladas), `link` las que sí la tienen. Sin `norm_hash` (no vistas desde el deploy) no
 * entran: el consumidor las saltaría; lo reciben en su próxima corrida. Por id, para que tandas sucesivas avancen.
 */
export async function listingsForStage(
  db: Db,
  input: { stage: "normalize" | "link"; version: number; category?: Category; store?: string; limit: number },
): Promise<number[]> {
  let query = db.query
    .selectFrom("listings as l")
    .select("l.id")
    .where("l.is_active", "=", 1)
    .where("l.norm_hash", "is not", null)
    .where((eb) => {
      const identity = eb.exists(
        eb
          .selectFrom("listing_identity as i")
          .select("i.listing_id")
          .whereRef("i.listing_id", "=", "l.id")
          .whereRef("i.input_hash", "=", "l.norm_hash")
          .where("i.version", "=", input.version),
      );
      return input.stage === "link" ? identity : eb.and([eb.not(identity), eb("l.norm_status", "!=", "pending")]);
    })
    .orderBy("l.id")
    .limit(input.limit);
  if (input.category) query = query.where("l.category", "=", input.category);
  if (input.store) {
    query = query.where("l.store_id", "in", db.query.selectFrom("stores").select("id").where("slug", "=", input.store));
  }
  return (await query.execute()).map((r) => r.id);
}

export async function countActiveListings(db: Db, storeId: number, category: Category): Promise<number> {
  const row = await db.query
    .selectFrom("listings")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("store_id", "=", storeId)
    .where((eb) => eb(eb.fn.coalesce("crawl_category", "category"), "=", category))
    .where("is_active", "=", 1)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

/**
 * Marca como inactivas las ofertas que la tienda ya no publica (no vistas en esta corrida). Se buscan por la
 * categoría de la corrida que las trajo, no por `category`, que el normalizador puede corregir (#97).
 */
export async function deactivateUnseen(db: Db, storeId: number, category: Category, runStartedAt: string, now: string) {
  const rows = await db.query
    .updateTable("listings")
    .set({ is_active: 0, updated_at: now })
    .where("store_id", "=", storeId)
    .where((eb) => eb(eb.fn.coalesce("crawl_category", "category"), "=", category))
    .where("is_active", "=", 1)
    .where("last_seen_at", "<", runStartedAt)
    .returning("id")
    .execute();
  return rows.length;
}
