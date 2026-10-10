// Pasa el texto libre de los productos guardados (línea, serie, modelo) por el vocabulario canónico de
// @framerate/matching (`canonicalText`) y recalcula `attribute_key`. Sólo lee D1; las sentencias quedan para revisar:
//   bun scripts/recanonize-products.ts <dir>   cifras por categoría y ejemplos; el SQL en <dir>/recanonize.sql
// Aplicarlo es aparte: bunx wrangler d1 execute framerate --remote --file <dir>/recanonize.sql
import type { Category } from "@framerate/contracts";
import { type Attributes, attributeKey, canonicalText, freeTextFields } from "@framerate/matching";
import { $ } from "bun";

const DB_DIR = new URL("../", import.meta.url).pathname;
const [dir] = process.argv.slice(2);
if (!dir) throw new Error("uso: recanonize-products.ts <dir>");

const out =
  await $`bunx wrangler d1 execute framerate --remote --json --command ${"SELECT id, category, brand, name, attributes, attribute_key FROM products WHERE attributes IS NOT NULL"}`
    .cwd(DB_DIR)
    .quiet()
    .text();
const rows = JSON.parse(out)[0].results as {
  id: number;
  category: Category;
  brand: string | null;
  name: string;
  attributes: string;
  attribute_key: string | null;
}[];

const sqlText = (v: string | null) => (v === null ? "NULL" : `'${v.replaceAll("'", "''")}'`);
const statements: string[] = [];
const byCategory: Record<string, number> = {};
const examples: string[] = [];
const keysBefore = new Map<string, number>();
const keysAfter = new Map<string, number>();
const count = (m: Map<string, number>, k: string | null) => k && m.set(k, (m.get(k) ?? 0) + 1);
for (const r of rows) {
  const before = JSON.parse(r.attributes) as Attributes;
  const attributes = { ...before };
  const changes: string[] = [];
  for (const field of freeTextFields(r.category)) {
    const value = before[field];
    if (typeof value !== "string" || !value) continue;
    const canonical = canonicalText(r.category, r.brand, field, value);
    if (canonical === value) continue;
    attributes[field] = canonical;
    changes.push(`${field} "${value}" a "${canonical}"`);
  }
  const key = attributeKey(r.category, r.brand, attributes);
  count(keysBefore, attributeKey(r.category, r.brand, before));
  count(keysAfter, key);
  if (!changes.length) continue;
  byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  // Dos por categoría para ver de todo.
  if (examples.filter((e) => e.includes(`[${r.category}]`)).length < 2) {
    examples.push(`#${r.id} [${r.category}] ${r.name}: ${changes.join(", ")}; clave ${r.attribute_key} a ${key}`);
  }
  statements.push(
    `UPDATE products SET attributes = ${sqlText(JSON.stringify(attributes))}, attribute_key = ${sqlText(key)} WHERE id = ${r.id};`,
  );
}
await Bun.write(`${dir}/recanonize.sql`, `${statements.join("\n")}\n`);
// Claves que comparten dos o más productos: posibles duplicados para revisar, aquí no se fusiona nada.
const shared = (m: Map<string, number>) => [...m.values()].filter((n) => n > 1).length;
console.log(
  JSON.stringify({
    products: rows.length,
    updated: statements.length,
    byCategory,
    sharedKeys: { before: shared(keysBefore), after: shared(keysAfter) },
  }),
);
for (const e of examples) console.log(e);
