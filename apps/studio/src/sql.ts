import {
  DummyDriver,
  type ExpressionBuilder,
  Kysely,
  type SelectQueryBuilder,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  sql,
} from "kysely";

export type Op = "=" | "!=" | ">" | "<" | "like" | "is null" | "is not null";
export type Filter = { column: string; op: Op; value?: string };
export type Sort = { column: string; dir: "asc" | "desc" };
export type Query = { sql: string; params: unknown[] };
export type Key = Record<string, unknown>;

export const ROWID = "__rowid";

// Sólo compila: las tablas se descubren en tiempo de ejecución, así que el esquema es `any`.
// biome-ignore lint/suspicious/noExplicitAny: tablas dinámicas
type Any = any;
const db = new Kysely<Any>({
  dialect: {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (d) => new SqliteIntrospector(d),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
});

const out = (c: { compile(): { sql: string; parameters: readonly unknown[] } }): Query => {
  const { sql, parameters } = c.compile();
  return { sql, params: [...parameters] };
};

// sql.id cita el nombre tal cual: Kysely parte los strings en "tabla.columna" y "columna dirección".
const where = <Q extends SelectQueryBuilder<Any, Any, Any>>(q: Q, filters: Filter[]): Q =>
  filters.reduce((acc, f) => {
    if (f.op === "is null") return acc.where(sql.id(f.column), "is", null) as Q;
    if (f.op === "is not null") return acc.where(sql.id(f.column), "is not", null) as Q;
    return acc.where(sql.id(f.column), f.op, f.value ?? "") as Q;
  }, q);

const byKey = (key: Key) => (eb: ExpressionBuilder<Any, Any>) =>
  eb.and(Object.entries(key).map(([k, v]) => eb(k === "rowid" ? sql.raw("rowid") : sql.id(k), "=", v)));

export function selectPage(
  table: string,
  o: { filters: Filter[]; sorts: Sort[]; limit: number; offset: number; rowid: boolean },
): Query {
  let q = db.selectFrom(table);
  if (o.rowid) q = q.select(sql.raw("rowid").as(ROWID));
  q = where(q.selectAll(), o.filters);
  for (const s of o.sorts) q = q.orderBy(sql.id(s.column), s.dir);
  return out(q.limit(o.limit).offset(o.offset));
}

export const countRows = (table: string, filters: Filter[]): Query =>
  out(where(db.selectFrom(table).select(db.fn.countAll().as("count")), filters));

export const updateRow = (table: string, key: Key, values: Record<string, unknown>): Query =>
  out(db.updateTable(table).set(values).where(byKey(key)));

export const insertRow = (table: string, values: Record<string, unknown>): Query =>
  out(db.insertInto(table).values(values));

export const deleteRow = (table: string, key: Key): Query => out(db.deleteFrom(table).where(byKey(key)));
