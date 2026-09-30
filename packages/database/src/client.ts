import { type Compilable, Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Database } from "./database";

/**
 * Acceso a D1 con Kysely (query builder tipado, sin ORM).
 *
 * - `query`: constructor de consultas tipado contra `Database`.
 * - `batch`: ejecuta varias escrituras en UNA transacción de D1. Kysely no
 *   expone transacciones interactivas en D1 (D1 no las soporta), así que las
 *   escrituras que deben ser atómicas se compilan y se envían juntas.
 */
export interface Db {
  query: Kysely<Database>;
  batch(queries: readonly Compilable[]): Promise<void>;
}

export function createDb(d1: D1Database): Db {
  return {
    query: new Kysely<Database>({ dialect: new D1Dialect({ database: d1 }) }),
    async batch(queries) {
      if (queries.length === 0) return;
      await d1.batch(
        queries.map((q) => {
          const { sql, parameters } = q.compile();
          return d1.prepare(sql).bind(...parameters);
        }),
      );
    },
  };
}
