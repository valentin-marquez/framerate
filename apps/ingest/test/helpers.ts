import { Database } from "bun:sqlite";
import type { Category, PipelineMessage } from "@framerate/contracts";
import { createDb } from "@framerate/database";
import { silentLogger } from "@framerate/kit";
import type { Env } from "@/env";
import { enqueueCrawls, initSchema, type Sql } from "@/features/ingestion/coordinator";
import type { CrawlCategoryDeps } from "@/features/ingestion/crawl-category";
import type { RawOffer } from "@/features/ingestion/domain/normalize";
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
    imageUrls: [],
    ...patch,
  };
}

/** Lo encolado en `framerate-normalize` queda en `sent`. */
export function testDeps(d1: D1Database, clock: () => Date): CrawlCategoryDeps & { sent: PipelineMessage[] } {
  let n = 0;
  const sent: PipelineMessage[] = [];
  const context: CrawlContext = {
    http: {
      get: () => Promise.reject(new Error("sin red en tests")),
      post: () => Promise.reject(new Error("sin red en tests")),
    },
    log: silentLogger,
    snapshot: async () => {},
  };
  return {
    db: createDb(d1),
    clock,
    log: silentLogger,
    newId: () => `run-${++n}-${clock().getTime()}`,
    createContext: () => context,
    enqueueNormalize: async (messages) => {
      sent.push(...messages);
    },
    sent,
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

function fakeQueue<T>(sent: T[]): Queue<T> {
  return {
    send: async (body: T) => {
      sent.push(body);
    },
    sendBatch: async (batch: Iterable<MessageSendRequest<T>>) => {
      for (const m of batch) sent.push(m.body);
    },
  } as unknown as Queue<T>;
}

/** Un `StoreCrawler` por slug con la misma cola SQL del de verdad, sobre `bun:sqlite`; sin alarm. */
function fakeStoreCrawlers() {
  const queues = new Map<string, Sql>();
  const sqlFor = (slug: string) => {
    let sql = queues.get(slug);
    if (!sql) {
      const db = new Database(":memory:");
      sql = (query, ...params) => db.query(query).all(...params) as never;
      initSchema(sql);
      queues.set(slug, sql);
    }
    return sql;
  };
  const namespace = {
    idFromName: (name: string) => name,
    get: (slug: string) => ({
      enqueue: async (_: string, categories: Category[], requestedBy: string) =>
        enqueueCrawls(sqlFor(slug), categories, requestedBy, Date.now()),
      ensureScheduled: async () => {},
    }),
  } as unknown as Env["STORE_CRAWLER"];
  const tasks = () =>
    [...queues].flatMap(([store, sql]) =>
      sql("SELECT category, requested_by FROM tasks ORDER BY rowid").map((t) => ({
        store,
        category: t.category,
        requestedBy: t.requested_by,
      })),
    );
  return { namespace, tasks };
}

/** Env de ingest con colas y coordinadores falsos que registran lo enviado. */
export function testEnv(d1: D1Database) {
  const normalize: PipelineMessage[] = [];
  const link: PipelineMessage[] = [];
  const crawlers = fakeStoreCrawlers();
  const env: Env = {
    DB: d1,
    SNAPSHOTS: {} as R2Bucket,
    ASSETS: {} as R2Bucket,
    STORE_CRAWLER: crawlers.namespace,
    NORMALIZE_QUEUE: fakeQueue(normalize),
    LINK_QUEUE: fakeQueue(link),
  };
  return { env, tasks: crawlers.tasks, normalize, link };
}
