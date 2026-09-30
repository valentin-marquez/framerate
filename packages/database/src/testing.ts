import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Selectable } from "kysely";
import { Miniflare } from "miniflare";
import { createDb, type Db } from "./client";
import type { Database } from "./database";

/**
 * Utilidades de test: D1 real (workerd vía Miniflare) con las migraciones SQL
 * reales aplicadas. Si los tipos de `database.ts` se desfasan de las
 * migraciones, los tests que usan esto fallan.
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
  return { d1, db: createDb(d1), dispose: () => mf.dispose() };
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

/** Vacía todas las tablas (respetando FKs al final de la transacción). */
export async function resetD1(d1: D1Database) {
  const { results } = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '%_fts%'",
    )
    .all<{ name: string }>();
  await d1.batch([
    d1.prepare("PRAGMA defer_foreign_keys = ON"),
    ...results.map((t) => d1.prepare(`DELETE FROM "${t.name}"`)),
  ]);
}

/** Todas las filas de una tabla (para aserciones en tests). */
export function all<T extends keyof Database>(db: Db, table: T): Promise<Selectable<Database[T]>[]> {
  return db.query
    .selectFrom(table as keyof Database)
    .selectAll()
    .execute() as Promise<Selectable<Database[T]>[]>;
}
