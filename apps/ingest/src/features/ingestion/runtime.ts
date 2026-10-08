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
import { type CrawlResult, crawlCategory, type PipelineMode } from "./crawl-category";
import { listingsForStage, markPending } from "./ingestion.repository";
import type { CrawlMessage } from "./messages";
import type { CrawlContext, StoreDefinition } from "./stores/adapter";
import { createHttpClient } from "./stores/http";
import { findStore, STORES } from "./stores/registry";

/**
 * Conexión de la ingesta con la plataforma (Queues, Cron, R2). La lógica vive
 * en `crawl-category.ts`; aquí sólo se arma el contexto de producción.
 */

/**
 * Pedido de crawls (lo usa la API vía RPC): valida la tienda y encola.
 * La API no conoce las tiendas registradas, sólo las conoce ingest.
 */
export async function requestCrawls(env: Env, request: EnqueueCrawlsRequest): Promise<EnqueueCrawlsResult> {
  if (request.store && !findStore(request.store)) return { ok: false, error: "unknown_store" };
  const enqueued = await enqueueAllCrawls(env, request.requestedBy, request);
  return { ok: true, enqueued };
}

export function pipelineModes(env: Env): { normalize: PipelineMode; link: PipelineMode } {
  const normalize = env.PIPELINE_NORMALIZE ?? "off";
  // Sin normalización nada llega a `framerate-link`: ocultar lo nuevo sería esconderlo hasta el plazo de 24 h.
  const link = normalize === "off" ? "off" : (env.PIPELINE_LINK ?? "off");
  return { normalize, link };
}

/**
 * Backfill y re-vínculo (RPC desde la API): `normalize` encola en `framerate-normalize` las ofertas activas sin
 * identidad de la versión actual y las deja `pending`; `link` encola en `framerate-link` las que ya la tienen.
 */
export async function requestPipeline(
  env: Env,
  request: z.output<typeof EnqueuePipelineRequestSchema>,
): Promise<EnqueuePipelineResult> {
  if (pipelineModes(env)[request.stage] === "off") return { ok: false, error: "pipeline_off" };
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

/** sendBatch acepta hasta 100 mensajes. */
export async function sendInBatches<T>(queue: Pick<Queue<T>, "sendBatch">, bodies: readonly T[]) {
  for (let i = 0; i < bodies.length; i += 100) {
    await queue.sendBatch(bodies.slice(i, i + 100).map((body) => ({ body })));
  }
}

/** Cron: encola una corrida por cada (tienda, categoría) que la tienda vende. */
export async function enqueueAllCrawls(
  env: Env,
  requestedBy: string,
  filter?: { store?: string; category?: Category },
) {
  const requestedAt = new Date().toISOString();
  const messages: CrawlMessage[] = [];
  for (const store of STORES) {
    if (store.pausedReason) continue;
    if (filter?.store && store.slug !== filter.store) continue;
    for (const [category, slugs] of Object.entries(store.adapter.categories)) {
      if (!slugs?.length) continue;
      if (filter?.category && category !== filter.category) continue;
      messages.push({
        type: "crawl.category",
        store: store.slug,
        category: category as Category,
        requestedAt,
        requestedBy,
      });
    }
  }
  await sendInBatches(env.CRAWL_QUEUE, messages);
  return messages.length;
}

export async function runCrawlMessage(env: Env, message: CrawlMessage, log: Logger): Promise<CrawlResult | null> {
  const store = findStore(message.store);
  if (!store) {
    log.warn("crawl.unknown_store", { store: message.store });
    return null;
  }
  return crawlCategory(
    {
      db: createDb(env.DB),
      clock: systemClock,
      log,
      newId: () => crypto.randomUUID(),
      createContext: (runId) => productionContext(env, store, message.category, runId, log),
      pipeline: {
        ...pipelineModes(env),
        enqueueNormalize: (messages: PipelineMessage[]) => sendInBatches(env.NORMALIZE_QUEUE, messages),
      },
    },
    store,
    message.category,
  );
}

function productionContext(
  env: Env,
  store: StoreDefinition,
  category: Category,
  runId: string,
  log: Logger,
): CrawlContext {
  const day = new Date().toISOString().slice(0, 10);
  return {
    http: createHttpClient({ minIntervalMs: store.minIntervalMs }),
    log: log.child({ store: store.slug, category, runId }),
    async snapshot(name, body) {
      // Comprimido: las respuestas JSON/HTML se reducen ~10x. Retención vía regla de ciclo de vida de R2.
      const gz = new Response(new Blob([body]).stream().pipeThrough(new CompressionStream("gzip")));
      await env.SNAPSHOTS.put(
        `snapshots/${store.slug}/${category}/${day}/${runId}/${name}.gz`,
        await gz.arrayBuffer(),
        {
          httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
        },
      );
    },
  };
}
