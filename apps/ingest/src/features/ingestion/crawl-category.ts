import type { Category } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import type { Clock, Logger } from "@framerate/kit";
import { matchListing } from "@framerate/matching";
import { normalizeOffer } from "./domain/normalize";
import {
  addToQuarantine,
  type CrawlStats,
  countActiveListings,
  deactivateUnseen,
  emptyStats,
  ensureStore,
  finishRun,
  startRun,
  upsertListing,
} from "./ingestion.repository";
import type { CrawlContext, StoreDefinition } from "./stores/adapter";

/**
 * Si una corrida trae menos de esta fracción de las ofertas activas conocidas,
 * probablemente la tienda cambió su sitio o falló a medias: NO se desactivan
 * las ofertas no vistas (sería vaciar el catálogo de esa tienda por un bug).
 */
export const MIN_HEALTHY_RATIO = 0.5;

export interface CrawlCategoryDeps {
  db: Db;
  clock: Clock;
  log: Logger;
  /** Crea el contexto de scraping (HTTP + snapshots) para esta corrida. */
  createContext(runId: string): CrawlContext;
  newId(): string;
}

export interface CrawlResult {
  runId: string;
  status: "succeeded" | "failed" | "skipped";
  stats: CrawlStats;
  error?: string;
}

/** Caso de uso: una corrida completa de (tienda, categoría). */
export async function crawlCategory(
  deps: CrawlCategoryDeps,
  store: StoreDefinition,
  category: Category,
): Promise<CrawlResult> {
  const { db, clock } = deps;
  const runId = deps.newId();
  const log = deps.log.child({ feature: "ingestion", store: store.slug, category, runId });
  const stats = emptyStats();
  const now = () => clock().toISOString();

  if (!store.adapter.categories[category]?.length) {
    return { runId, status: "skipped", stats };
  }

  const startedAt = now();
  const storeRow = await ensureStore(db, store, startedAt);
  if (!storeRow.isActive) {
    log.info("crawl.skipped_inactive_store");
    return { runId, status: "skipped", stats };
  }
  await startRun(db, { id: runId, storeId: storeRow.id, category, now: startedAt });
  const previousActive = await countActiveListings(db, storeRow.id, category);
  log.info("crawl.started", { previousActive });

  const seen = new Set<string>();
  try {
    for await (const raw of store.adapter.crawlCategory(category, deps.createContext(runId))) {
      stats.seen++;
      const result = normalizeOffer(raw, category);
      if (!result.ok) {
        stats.quarantined++;
        await addToQuarantine(db, {
          runId,
          storeId: storeRow.id,
          externalId: result.externalId,
          reason: result.reason,
          payload: raw,
          now: now(),
        });
        continue;
      }

      const { offer } = result;
      // La misma oferta puede aparecer en dos slugs de categoría de la tienda.
      if (seen.has(offer.externalId)) {
        stats.duplicates++;
        continue;
      }
      seen.add(offer.externalId);
      stats.valid++;

      const upsert = await upsertListing(db, storeRow.id, offer, now());
      if (upsert.created) stats.created++;
      else stats.updated++;
      if (upsert.priceChanged && !upsert.created) stats.priceChanges++;

      if (upsert.identityChanged) {
        const match = await matchListing(db, {
          listingId: upsert.listingId,
          currentProductId: upsert.productId,
          offer,
          now: now(),
        });
        if (match.unlinked) stats.unlinked++;
        if (match.outcome === "linked") stats.linked++;
        else if (match.outcome === "new_product") stats.newProducts++;
        else if (match.outcome === "review") {
          stats.newProducts++;
          stats.reviews++;
        }
      }
    }

    if (previousActive > 0 && stats.valid === 0) {
      throw new Error("La corrida no trajo ofertas válidas pero la tienda tenía ofertas activas (¿cambió el sitio?)");
    }
    if (stats.valid >= previousActive * MIN_HEALTHY_RATIO) {
      stats.deactivated = await deactivateUnseen(db, storeRow.id, category, startedAt, now());
    } else {
      stats.deactivationSkipped = true;
      log.warn("crawl.deactivation_skipped", { valid: stats.valid, previousActive });
    }

    await finishRun(db, runId, { status: "succeeded", stats, now: now() });
    log.info("crawl.succeeded", { ...stats });
    return { runId, status: "succeeded", stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(db, runId, { status: "failed", stats, error: message, now: now() });
    log.error("crawl.failed", { error, ...stats });
    return { runId, status: "failed", stats, error: message };
  }
}
