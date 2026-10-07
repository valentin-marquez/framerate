/**
 * Rellena `products.search` (el nombre normalizado para la búsqueda, #129) en los productos creados antes de la
 * migración 0019. Cada UPDATE dispara el trigger del índice FTS, así que no hace falta reconstruirlo aparte.
 *
 * Lee el JSON de wrangler por la entrada estándar y escribe el SQL en la salida, para poder revisarlo antes:
 *
 *   cd packages/database
 *   bunx wrangler d1 execute framerate --remote --json \
 *     --command "select id, name from products where search is null" \
 *     | bun run ../../apps/ingest/scripts/backfill-product-search.ts > /tmp/backfill-search.sql
 *   bunx wrangler d1 execute framerate --remote --file /tmp/backfill-search.sql
 *
 * Es idempotente: sólo toca las filas con `search` nula, y volver a correrlo no cambia nada.
 */
import { searchText } from "@framerate/kit";

const input = await Bun.stdin.text();
// wrangler imprime avisos antes del JSON.
const json = input.slice(input.indexOf("["));
const parsed = JSON.parse(json) as Array<{ results: Array<{ id: number; name: string }> }>;
const rows = parsed.flatMap((r) => r.results ?? []);

const lines = rows.map(({ id, name }) => {
  const value = searchText(name).replaceAll("'", "''");
  return `UPDATE products SET search = '${value}' WHERE id = ${id} AND search IS NULL;`;
});

console.log(lines.join("\n"));
console.error(`${lines.length} productos`);
