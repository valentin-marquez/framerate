import type { Category } from "@framerate/contracts";
import type { Env } from "@/env";
import { systemClock } from "@/shared/clock";
import { createDb } from "@/shared/db/client";
import type { Logger } from "@/shared/logger";
import { type CrawlResult, crawlCategory } from "./crawl-category";
import type { CrawlMessage } from "./messages";
import type { CrawlContext, StoreDefinition } from "./stores/adapter";
import { createHttpClient } from "./stores/http";
import { findStore, STORES } from "./stores/registry";

/**
 * Conexión de la ingesta con la plataforma (Queues, Cron, R2). La lógica vive
 * en `crawl-category.ts`; aquí sólo se arma el contexto de producción.
 */

/** Cron: encola una corrida por cada (tienda, categoría) que la tienda vende. */
export async function enqueueAllCrawls(
  env: Env,
  requestedBy: string,
  filter?: { store?: string; category?: Category },
) {
  const requestedAt = new Date().toISOString();
  const messages: CrawlMessage[] = [];
  for (const store of STORES) {
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
  // sendBatch acepta hasta 100 mensajes.
  for (let i = 0; i < messages.length; i += 100) {
    await env.CRAWL_QUEUE.sendBatch(messages.slice(i, i + 100).map((body) => ({ body })));
  }
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
    http: createHttpClient(),
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
