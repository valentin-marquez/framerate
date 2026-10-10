// Calcula `products.family_key` (#101) desde `attributes` para los productos que ya existen y deja las sentencias para
// revisar. Sólo lee D1:
//   bun scripts/backfill-family-key.ts <dir>   cifras y ejemplos; el SQL en <dir>/family-key.sql
// Aplicarlo es aparte: bunx wrangler d1 execute framerate --remote --file <dir>/family-key.sql

import type { Category } from "@framerate/contracts";
import { type Attributes, familyKey } from "@framerate/matching";
import { $ } from "bun";

const [dir] = process.argv.slice(2);
if (!dir) throw new Error("uso: bun scripts/backfill-family-key.ts <dir>");

const out =
  await $`bunx wrangler d1 execute framerate --remote --json --command ${"SELECT id, category, brand, name, attributes, family_key FROM products"}`.text();
const rows = JSON.parse(out.slice(out.indexOf("[")))[0].results as {
  id: number;
  category: Category;
  brand: string | null;
  name: string;
  attributes: string | null;
  family_key: string | null;
}[];

const sql: string[] = [];
const families = new Map<string, string[]>();
for (const r of rows) {
  const key = familyKey(r.category, JSON.parse(r.attributes ?? "{}") as Attributes);
  if (key) families.set(key, [...(families.get(key) ?? []), r.name]);
  if (key === r.family_key) continue;
  sql.push(`UPDATE products SET family_key = ${key ? `'${key.replaceAll("'", "''")}'` : "NULL"} WHERE id = ${r.id};`);
}
await Bun.write(`${dir}/family-key.sql`, `${sql.join("\n")}\n`);
const grouped = [...families.values()].filter((g) => g.length > 1);
console.log(
  `${rows.length} productos, ${sql.length} cambian, ${families.size} familias, ${grouped.length} con variantes`,
);
for (const g of grouped.sort(() => Math.random() - 0.5).slice(0, 8)) console.log(`- ${g.join(" | ")}`);
