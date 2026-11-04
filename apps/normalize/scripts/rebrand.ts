// Pone la marca a las identidades de mouses y teclados que quedaron sin ella porque la marca no estaba en el diccionario
// (#218), sin volver a llamar a Haiku. Después, reseed-products.ts rehace los productos. Uso:
//   bun scripts/rebrand.ts <dir>           en seco: cuántas cambian, por marca, y el SQL en <dir>/rebrand.sql
//   bun scripts/rebrand.ts <dir> --apply   escribe en D1

import { fileURLToPath } from "node:url";
import { type Category, NORMALIZER_VERSION } from "@framerate/contracts";
import { resolveBrand } from "@framerate/matching";
import { $ } from "bun";

interface Row {
  listing_id: number;
  category: Category;
  declared: string | null;
  title: string;
}

/** La marca que le toca a una identidad sin marca; null si el título y la tienda no nombran una conocida. */
export const brandFor = (r: Row) => resolveBrand({ category: r.category, title: r.title, brand: r.declared });

if (import.meta.main) {
  const DB_DIR = fileURLToPath(new URL("../../../packages/database/", import.meta.url));
  const [dir, flag] = process.argv.slice(2);
  if (!dir) throw new Error("uso: rebrand.ts <dir> [--apply]");

  const out = await $`bunx wrangler d1 execute framerate --remote --json --command ${`SELECT i.listing_id, i.category,
    l.brand declared, coalesce(l.raw_title, l.title) title FROM listing_identity i JOIN listings l ON l.id = i.listing_id
    WHERE i.version = ${NORMALIZER_VERSION} AND i.category IN ('mouse', 'keyboard')
      AND (i.brand IS NULL OR i.brand = '')`}`
    .cwd(DB_DIR)
    .quiet()
    .text();
  const rows = JSON.parse(out)[0].results as Row[];

  const statements: string[] = [];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const brand = brandFor(r);
    if (!brand) continue;
    const key = `${r.category}|${brand}`;
    counts[key] = (counts[key] ?? 0) + 1;
    statements.push(
      `UPDATE listing_identity SET brand = '${brand.replaceAll("'", "''")}' WHERE listing_id = ${r.listing_id} AND version = ${NORMALIZER_VERSION};`,
    );
  }
  await Bun.write(`${dir}/rebrand.sql`, statements.join("\n"));
  console.log(JSON.stringify({ withoutBrand: rows.length, updated: statements.length, byBrand: counts }));
  if (flag === "--apply" && statements.length) {
    await $`bunx wrangler d1 execute framerate --remote --file ${dir}/rebrand.sql --yes`.cwd(DB_DIR).quiet();
    console.log("aplicado");
  }
}
