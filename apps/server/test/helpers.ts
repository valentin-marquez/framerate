import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Selectable } from "kysely";
import { Miniflare } from "miniflare";
import type { Env } from "@/env";
import type { CrawlCategoryDeps } from "@/features/ingestion/crawl-category";
import type { RawOffer } from "@/features/ingestion/domain/normalize";
import type { CrawlMessage } from "@/features/ingestion/messages";
import type { CrawlContext, StoreDefinition } from "@/features/ingestion/stores/adapter";
import { createDb, type Db } from "@/shared/db/client";
import type { Database } from "@/shared/db/database";
import { silentLogger } from "@/shared/logger";

/**
 * D1 real (workerd vía Miniflare) con las migraciones SQL reales aplicadas.
 * Si los tipos de `database.ts` se desfasan de las migraciones, estos tests fallan.
 */
export async function createTestD1() {
  const mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  const d1 = (await mf.getD1Database("DB")) as unknown as D1Database;
  const dir = join(import.meta.dir, "..", "migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const statements = splitSql(readFileSync(join(dir, file), "utf8"));
    await d1.batch(statements.map((s) => d1.prepare(s)));
  }
  return { d1, dispose: () => mf.dispose() };
}

/** Separa un archivo de migración en sentencias (respeta bloques BEGIN…END de triggers). */
function splitSql(source: string): string[] {
  const statements: string[] = [];
  let current: string[] = [];
  let inTrigger = false;
  for (const rawLine of source.split("\n")) {
    const line = rawLine.replace(/--.*$/, "").trimEnd();
    if (!line.trim()) continue;
    current.push(line);
    if (/^\s*CREATE TRIGGER/i.test(line)) inTrigger = true;
    const done = inTrigger ? /^\s*END;\s*$/i.test(line) : line.endsWith(";");
    if (done) {
      statements.push(current.join("\n"));
      current = [];
      inTrigger = false;
    }
  }
  return statements;
}

const TABLES = [
  "quarantine",
  "match_reviews",
  "match_decisions",
  "price_points",
  "listings",
  "product_identifiers",
  "products",
  "crawl_runs",
  "stores",
];

export async function resetD1(d1: D1Database) {
  await d1.batch(TABLES.map((t) => d1.prepare(`DELETE FROM ${t}`)));
}

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

export function testEnv(d1: D1Database) {
  const sent: CrawlMessage[] = [];
  const env: Env = {
    DB: d1,
    ADMIN_TOKEN: "test-admin-token",
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

/** Todas las filas de una tabla (para aserciones en tests). */
export function all<T extends keyof Database>(deps: { db: Db }, table: T): Promise<Selectable<Database[T]>[]> {
  return deps.db.query
    .selectFrom(table as keyof Database)
    .selectAll()
    .execute() as Promise<Selectable<Database[T]>[]>;
}
