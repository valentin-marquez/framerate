import { createDb } from "@framerate/database";
import { silentLogger } from "@framerate/kit";
import type { Env } from "@/env";
import type { CrawlCategoryDeps } from "@/features/ingestion/crawl-category";
import type { RawOffer } from "@/features/ingestion/domain/normalize";
import type { CrawlMessage } from "@/features/ingestion/messages";
import type { CrawlContext, StoreDefinition } from "@/features/ingestion/stores/adapter";

/** Tienda falsa cuyo catálogo se controla desde el test. */
export function fakeStore(slug: string, categories: StoreDefinition["adapter"]["categories"]) {
  let offers: Array<Partial<RawOffer> | unknown> = [];
  let failWith: Error | null = null;
  const store: StoreDefinition = {
    slug,
    name: slug.toUpperCase(),
    url: `https://${slug}.example`,
    adapter: {
      categories,
      async *crawlCategory(category) {
        if (failWith) throw failWith;
        for (const o of offers) {
          const raw = o as Partial<RawOffer>;
          if (raw.category === undefined || raw.category === category) yield { category, ...raw } as RawOffer;
        }
      },
    },
  };
  return {
    store,
    setOffers(next: Array<Partial<RawOffer> | unknown>) {
      offers = next;
      failWith = null;
    },
    fail(error: Error) {
      failWith = error;
    },
  };
}

/** Oferta cruda válida con valores por defecto razonables. */
export function offer(storeSlug: string, externalId: string, patch: Partial<RawOffer>): Partial<RawOffer> {
  return {
    externalId,
    url: `https://${storeSlug}.example/p/${externalId}`,
    priceCard: null,
    inStock: true,
    stockQuantity: null,
    brand: null,
    mpn: null,
    gtin: null,
    imageUrl: null,
    ...patch,
  };
}

export function testDeps(d1: D1Database, clock: () => Date): CrawlCategoryDeps {
  let n = 0;
  const context: CrawlContext = {
    http: { get: () => Promise.reject(new Error("sin red en tests")) },
    log: silentLogger,
    snapshot: async () => {},
  };
  return {
    db: createDb(d1),
    clock,
    log: silentLogger,
    newId: () => `run-${++n}-${clock().getTime()}`,
    createContext: () => context,
  };
}

/** Reloj controlable: cada llamada avanza 1 segundo. */
export function steppingClock(start = "2026-09-01T00:00:00.000Z") {
  let t = new Date(start).getTime();
  const clock = () => {
    t += 1000;
    return new Date(t);
  };
  return Object.assign(clock, {
    advance(ms: number) {
      t += ms;
    },
  });
}

/** Env de ingest con una cola falsa que registra lo enviado. */
export function testEnv(d1: D1Database) {
  const sent: CrawlMessage[] = [];
  const env: Env = {
    DB: d1,
    SNAPSHOTS: {} as R2Bucket,
    CRAWL_QUEUE: {
      send: async (body: CrawlMessage) => {
        sent.push(body);
      },
      sendBatch: async (batch: Iterable<MessageSendRequest<CrawlMessage>>) => {
        for (const m of batch) sent.push(m.body);
      },
    } as unknown as Queue<CrawlMessage>,
  };
  return { env, sent };
}
