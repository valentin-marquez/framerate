import { refreshProductsPriceSummary } from "@framerate/database";
import type { CrawlCategoryDeps } from "./crawl-category";
import { MIN_HEALTHY_RATIO } from "./crawl-category";
import { normalizeOffer, normHash, rawHashInput } from "./domain/normalize";
import {
  addToQuarantine,
  ensureStore,
  finishRun,
  listImportantOffers,
  type RefreshStats,
  refreshListing,
  startRun,
  touchSeen,
} from "./ingestion.repository";
import type { CrawlContext, StoreDefinition } from "./stores/adapter";

export type RefreshStoreDeps = Omit<CrawlCategoryDeps, "enqueueNormalize">;

/**
 * La alarm del Durable Object muere a los 15 min sin cerrar nada. El margen cubre lo que puede tardar la última petición
 * ya en curso: tres esperas por 429 (90 s) y cuatro timeouts de 20 s.
 */
export const REFRESH_BUDGET_MS = 11 * 60_000;

class RefreshBudgetExhausted extends Error {}

export interface RefreshResult {
  runId: string;
  status: "succeeded" | "failed" | "skipped";
  stats: RefreshStats;
  error?: string;
}

/**
 * Refresco horario de una tienda (#121, spec #201 §4): vuelve a leer precio y stock de las ofertas que importan. No
 * reutiliza `crawlCategory`, que desactiva lo no visto y manda a vincular: aquí sólo cambian precio y stock de ofertas
 * ya conocidas, y lo que la tienda no devolvió se queda como está.
 */
export async function refreshStore(deps: RefreshStoreDeps, store: StoreDefinition): Promise<RefreshResult> {
  const { db, clock } = deps;
  const runId = deps.newId();
  const log = deps.log.child({ feature: "ingestion", store: store.slug, category: "refresh", runId });
  const stats: RefreshStats = { requested: 0, fetched: 0, changed: 0, missing: 0, quarantined: 0, truncated: false };
  const now = () => clock().toISOString();
  const refreshOffers = store.adapter.refreshOffers;
  if (!refreshOffers) return { runId, status: "skipped", stats };

  const storeRow = await ensureStore(db, store, now());
  if (!storeRow.isActive) return { runId, status: "skipped", stats };
  const known = await listImportantOffers(db, storeRow.id);
  // Sin ofertas que importen no hay corrida: una fila vacía por hora sólo ensuciaría `crawl_runs`.
  if (known.length === 0) return { runId, status: "skipped", stats };
  stats.requested = known.length;
  const byExternalId = new Map(known.map((o) => [o.externalId, o]));

  await startRun(db, { id: runId, storeId: storeRow.id, category: "refresh", now: now() });
  const seen = new Set<string>();
  const unchanged: number[] = [];
  const changedProducts = new Set<number>();
  const context = deps.createContext(runId);
  const deadline = clock().getTime() + REFRESH_BUDGET_MS;
  const inBudget = () => {
    if (clock().getTime() >= deadline) throw new RefreshBudgetExhausted("Se agotó el presupuesto del refresco");
  };
  // En cada petición y no en cada oferta: una tienda que devuelve pocas ofertas igual tiene que cortar a tiempo.
  const budgeted: CrawlContext = {
    ...context,
    http: {
      get: async (url, init) => {
        inBudget();
        return context.http.get(url, init);
      },
      post: async (url, json, init) => {
        inBudget();
        return context.http.post(url, json, init);
      },
    },
  };
  const offers = async function* () {
    try {
      yield* refreshOffers.call(store.adapter, known, budgeted);
    } catch (error) {
      if (!(error instanceof RefreshBudgetExhausted)) throw error;
      stats.truncated = true;
    }
  };
  try {
    for await (const raw of offers()) {
      const current = byExternalId.get(raw.externalId);
      if (!current || seen.has(raw.externalId)) continue;
      seen.add(raw.externalId);
      stats.fetched++;
      const result = normalizeOffer(raw, current.category);
      if (!result.ok) {
        stats.quarantined++;
        await addToQuarantine(db, {
          runId,
          storeId: storeRow.id,
          externalId: result.externalId,
          reason: result.reason,
          payload: raw,
          hash: await normHash(rawHashInput(raw, current.category)),
          now: now(),
        });
        continue;
      }
      const change = await refreshListing(db, current, result.offer, now());
      if (!change) {
        unchanged.push(current.id);
        continue;
      }
      if (change.priceChanged) {
        stats.changed++;
        changedProducts.add(current.productId);
      }
    }
    // Una corrida cortada no sabe cuántas alcanzó a pedir: lo no pedido no es una falta de la tienda.
    if (!stats.truncated) stats.missing = stats.requested - stats.fetched;

    await touchSeen(db, unchanged, now());
    if (stats.fetched === 0) throw new Error("El refresco no trajo ninguna de las ofertas pedidas (¿cambió la API?)");
    if (!stats.truncated && stats.fetched < stats.requested * MIN_HEALTHY_RATIO)
      log.warn("refresh.low_coverage", { ...stats });
    if (changedProducts.size > 0) {
      await refreshProductsPriceSummary(db, changedProducts, clock(), { throttleVersion: true });
    }
    await finishRun(db, runId, { status: "succeeded", stats, now: now() });
    log.info("refresh.succeeded", { ...stats });
    return { runId, status: "succeeded", stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(db, runId, { status: "failed", stats, error: message, now: now() });
    log.error("refresh.failed", { error, ...stats });
    return { runId, status: "failed", stats, error: message };
  }
}
