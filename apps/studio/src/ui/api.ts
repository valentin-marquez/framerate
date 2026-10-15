import type { Result, Target } from "../targets";

export type Column = { name: string; type: string; notnull: number; dflt_value: unknown; pk: number };

export async function query(target: Target, sql: string, params: unknown[] = []): Promise<Result> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target, sql, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body as Result;
}

export const objects = (r: Result) =>
  r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])) as Record<string, unknown>);

// _cf_* son tablas internas de D1: leerlas da error en producción.
export const tables = async (target: Target) =>
  objects(
    await query(
      target,
      "select name, type from sqlite_master where type in ('table','view') and name not like 'sqlite!_%' escape '!' and name not like '!_cf!_%' escape '!' order by name",
    ),
  ) as { name: string; type: string }[];

export async function schema(target: Target, table: string) {
  const [columns, ddl, fks] = await Promise.all([
    query(target, "select * from pragma_table_info(?)", [table]),
    query(target, "select type, name, sql from sqlite_master where tbl_name = ? order by type desc", [table]),
    query(target, "select * from pragma_foreign_key_list(?)", [table]),
  ]);
  return {
    columns: objects(columns) as Column[],
    ddl: objects(ddl) as { type: string; name: string; sql: string | null }[],
    fks: objects(fks),
  };
}

// Tablas y columnas para el autocompletado de la consola, en una sola consulta.
export async function completionSchema(target: Target) {
  const r = await query(
    target,
    "select m.name, p.name from sqlite_master m join pragma_table_info(m.name) p where m.type in ('table','view') and m.name not like 'sqlite!_%' escape '!' and m.name not like '!_cf!_%' escape '!'",
  );
  const schema: Record<string, string[]> = {};
  for (const [t, c] of r.rows as [string, string][]) schema[t] = [...(schema[t] ?? []), c];
  return schema;
}
