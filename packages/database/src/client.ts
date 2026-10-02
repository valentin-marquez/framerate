import { type Compilable, Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Database } from "./database";

/**
 * Acceso a D1 con Kysely (query builder tipado, sin ORM).
 *
 * - `query`: constructor de consultas tipado contra `Database`.
 * - `read`: varias lecturas en UN viaje a D1. Cada viaje a la primaria cuesta ~150 ms desde Chile, y las consultas
 *   sueltas (también con `Promise.all`) no se juntan.
 * - `batch`: ejecuta varias escrituras en UNA transacción de D1. Kysely no
 *   expone transacciones interactivas en D1 (D1 no las soporta), así que las
 *   escrituras que deben ser atómicas se compilan y se envían juntas.
 */
export interface Db {
  query: Kysely<Database>;
  read<const Q extends readonly Compilable<object>[]>(
    queries: Q,
  ): Promise<{ [K in keyof Q]: Q[K] extends Compilable<infer R> ? R[] : never }>;
  batch(queries: readonly Compilable[]): Promise<void>;
}

/** `onQuery` recibe la duración en ms de cada viaje a D1 (para medir cuánto del request se va en D1). */
export function createDb(d1: D1Database, onQuery?: (ms: number) => void): Db {
  const prepare = (q: Compilable) => {
    const { sql, parameters } = q.compile();
    return d1.prepare(sql).bind(...parameters);
  };
  return {
    query: new Kysely<Database>({
      dialect: new D1Dialect({ database: d1 }),
      log: onQuery && ((event) => onQuery(event.queryDurationMillis)),
    }),
    async read(queries) {
      const start = Date.now();
      const results = await d1.batch(queries.map(prepare));
      onQuery?.(Date.now() - start);
      return results.map((r) => r.results) as never;
    },
    async batch(queries) {
      if (queries.length === 0) return;
      await d1.batch(queries.map(prepare));
    },
  };
}
