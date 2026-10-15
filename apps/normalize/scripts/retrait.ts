// Agrega a las identidades guardadas los rasgos del título (titleTraits, #153) sin volver a llamar a Haiku: son
// deterministas y salen del mismo título que ya se ancló. Después, reseed-products.ts rehace los productos. Uso:
//   bun scripts/retrait.ts <dir>           en seco: cuántas cambian y el SQL en <dir>/retrait.sql
//   bun scripts/retrait.ts <dir> --apply   escribe en D1

import { fileURLToPath } from "node:url";
import { type Category, NORMALIZER_VERSION } from "@framerate/contracts";
import { TRAIT_DISCRIMINATORS, TRAIT_INFO, titleTraits } from "@framerate/matching";
import { $ } from "bun";

const DB_DIR = fileURLToPath(new URL("../../../packages/database/", import.meta.url));
const [dir, flag] = process.argv.slice(2);
if (!dir) throw new Error("uso: retrait.ts <dir> [--apply]");

const out = await $`bunx wrangler d1 execute framerate --remote --json --command ${`SELECT i.listing_id, i.category,
  i.identity, coalesce(l.raw_title, l.title) title FROM listing_identity i JOIN listings l ON l.id = i.listing_id
  WHERE i.version = ${NORMALIZER_VERSION}`}`
  .cwd(DB_DIR)
  .quiet()
  .text();
const rows = JSON.parse(out)[0].results as {
  listing_id: number;
  category: Category;
  identity: string;
  title: string;
}[];

const statements: string[] = [];
const counts: Record<string, number> = {};
for (const r of rows) {
  const identity = JSON.parse(r.identity) as Record<string, unknown>;
  for (const f of [...TRAIT_DISCRIMINATORS, ...TRAIT_INFO]) delete identity[f];
  const traits = titleTraits(r.category, r.title);
  for (const [k, v] of Object.entries(traits)) if (v !== "") counts[k] = (counts[k] ?? 0) + 1;
  const next = JSON.stringify({ ...identity, ...traits });
  if (next === r.identity) continue;
  statements.push(
    `UPDATE listing_identity SET identity = '${next.replaceAll("'", "''")}' WHERE listing_id = ${r.listing_id} AND version = ${NORMALIZER_VERSION};`,
  );
}
await Bun.write(`${dir}/retrait.sql`, statements.join("\n"));
console.log(JSON.stringify({ identities: rows.length, updated: statements.length, withTrait: counts }));
if (flag === "--apply" && statements.length) {
  await $`bunx wrangler d1 execute framerate --remote --file ${dir}/retrait.sql --yes`.cwd(DB_DIR).quiet();
  console.log("aplicado");
}
