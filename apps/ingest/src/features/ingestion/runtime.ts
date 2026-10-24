import {
  type Category,
  type EnqueueCrawlsRequest,
  type EnqueueCrawlsResult,
  type EnqueuePipelineRequestSchema,
  type EnqueuePipelineResult,
  NORMALIZER_VERSION,
  type PipelineMessage,
} from "@framerate/contracts";
import { createDb } from "@framerate/database";
import type { Logger } from "@framerate/kit";
import { systemClock } from "@framerate/kit";
import type { z } from "zod";
import type { Env } from "@/env";
import { type CrawlResult, crawlCategory } from "./crawl-category";
import type { RawOffer } from "./domain/normalize";
import { knownOffers, listingsForStage, markPending, retryStuck } from "./ingestion.repository";
import { type RefreshResult, refreshStore } from "./refresh-store";
import type { CrawlContext, StoreDefinition } from "./stores/adapter";
import { createHttpClient } from "./stores/http";
import { findStore, STORES } from "./stores/registry";
import { relayFetch } from "./stores/relay";

/**
 * Conexión de la ingesta con la plataforma (Durable Objects, Queues, Cron, R2). La lógica vive
 * en `crawl-category.ts`; aquí sólo se arma el contexto de producción.
 */

/**
 * Pedido de crawls (la API vía RPC): valida la tienda y encola en su Durable Object. La API no conoce las tiendas
 * registradas, sólo las conoce ingest. `enqueued` no cuenta lo que ya estaba encolado.
 */
export async function requestCrawls(env: Env, request: EnqueueCrawlsRequest): Promise<EnqueueCrawlsResult> {
  if (request.store && !findStore(request.store)) return { ok: false, error: "unknown_store" };
  const counts = await Promise.all(
    STORES.filter((store) => !store.pausedReason && (!request.store || store.slug === request.store)).map((store) => {
      const categories = storeCategories(store).filter((c) => !request.category || c === request.category);
      return categories.length ? storeCrawler(env, store.slug).enqueue(store.slug, categories, request.requestedBy) : 0;
    }),
  );
  return { ok: true, enqueued: counts.reduce((a, b) => a + b, 0) };
}

/**
 * Backfill y re-vínculo (RPC desde la API): `normalize` encola en `framerate-normalize` las ofertas activas sin
 * identidad de la versión actual y las deja `pending`; `link` encola en `framerate-link` las que ya la tienen.
 */
export async function requestPipeline(
  env: Env,
  request: z.output<typeof EnqueuePipelineRequestSchema>,
): Promise<EnqueuePipelineResult> {
  if (request.store && !findStore(request.store)) return { ok: false, error: "unknown_store" };
  const db = createDb(env.DB);
  const ids = await listingsForStage(db, { ...request, version: NORMALIZER_VERSION });
  const messages = ids.map((listingId) => ({ listingId, version: NORMALIZER_VERSION, reason: request.reason }));
  if (request.stage === "normalize") {
    await markPending(db, ids, new Date().toISOString());
    await sendInBatches(env.NORMALIZE_QUEUE, messages);
  } else {
    await sendInBatches(env.LINK_QUEUE, messages);
  }
  return { ok: true, enqueued: ids.length };
}

/** Cron: vuelve a encolar en `framerate-normalize` lo que lleva más de 24 h sin salir de `pending` o `normalized`. */
export async function retryStuckNormalize(env: Env, now: Date): Promise<number> {
  const ids = await retryStuck(createDb(env.DB), now);
  await sendInBatches(
    env.NORMALIZE_QUEUE,
    ids.map((listingId) => ({ listingId, version: NORMALIZER_VERSION, reason: "changed" as const })),
  );
  return ids.length;
}

/** sendBatch acepta hasta 100 mensajes. */
export async function sendInBatches<T>(queue: Pick<Queue<T>, "sendBatch">, bodies: readonly T[]) {
  for (let i = 0; i < bodies.length; i += 100) {
    await queue.sendBatch(bodies.slice(i, i + 100).map((body) => ({ body })));
  }
}

/** El Durable Object de la tienda, junto a D1 (ENAM): la pista sólo cuenta al crearlo. */
export function storeCrawler(env: Env, slug: string) {
  return env.STORE_CRAWLER.get(env.STORE_CRAWLER.idFromName(slug), { locationHint: "enam" });
}

export function storeCategories(store: StoreDefinition): Category[] {
  return Object.entries(store.adapter.categories)
    .filter(([, slugs]) => slugs?.length)
    .map(([category]) => category as Category);
}

/** Cron horario: cada tienda activa con su agenda y su alarm. */
export async function ensureAllScheduled(env: Env) {
  const active = STORES.filter((store) => !store.pausedReason);
  await Promise.all(active.map((store) => storeCrawler(env, store.slug).ensureScheduled(store.slug)));
  return active.length;
}

export async function runCrawl(
  env: Env,
  store: StoreDefinition,
  category: Category,
  log: Logger,
  runId: string,
): Promise<CrawlResult> {
  return crawlCategory(
    {
      db: createDb(env.DB),
      clock: systemClock,
      log,
      newId: () => runId,
      createContext: () => productionContext(env, store, category, runId, log),
      enqueueNormalize: (messages: PipelineMessage[]) => sendInBatches(env.NORMALIZE_QUEUE, messages),
    },
    store,
    category,
  );
}

/** Refresco horario de la tienda (#121): sus snapshots van bajo `refresh/` en lugar de una categoría. */
export function runRefresh(env: Env, store: StoreDefinition, log: Logger, runId: string): Promise<RefreshResult> {
  return refreshStore(
    {
      db: createDb(env.DB),
      clock: systemClock,
      log,
      newId: () => runId,
      createContext: () => productionContext(env, store, "refresh", runId, log),
    },
    store,
  );
}

function productionContext(
  env: Env,
  store: StoreDefinition,
  category: Category | "refresh",
  runId: string,
  log: Logger,
): CrawlContext {
  const day = new Date().toISOString().slice(0, 10);
  const storeLog = log.child({ store: store.slug, category, runId });
  let known: Promise<Map<string, RawOffer>> | undefined;
  const relay = store.egress === "relay" && env.RELAY_URL && env.RELAY_TOKEN;
  if (store.egress === "relay" && !relay) storeLog.warn("egress.relay_unconfigured");
  return {
    http: createHttpClient({
      minIntervalMs: store.minIntervalMs,
      timeoutMs: store.timeoutMs,
      renders: Boolean(relay),
      fetch: relay
        ? relayFetch({ url: env.RELAY_URL as string, token: env.RELAY_TOKEN as string, log: storeLog })
        : undefined,
    }),
    log: storeLog,
    known: (url) => {
      known ??= knownOffers(createDb(env.DB), store.slug);
      return known.then((offers) => offers.get(url));
    },
    async snapshot(name, body) {
      // Comprimido: las respuestas JSON/HTML se reducen ~10x. Retención vía regla de ciclo de vida de R2.
      const gz = new Response(new Blob([body]).stream().pipeThrough(new CompressionStream("gzip")));
      try {
        await env.SNAPSHOTS.put(
          `snapshots/${store.slug}/${category}/${day}/${runId}/${name}.gz`,
          await gz.arrayBuffer(),
          {
            httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
          },
        );
      } catch (error) {
        // El snapshot es diagnóstico, no dato: un error transitorio de R2 (10001) no tumba la corrida (#220).
        storeLog.warn("snapshot.failed", { name, error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
