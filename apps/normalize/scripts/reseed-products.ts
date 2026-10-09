// Fase 4 de #153 de una vez: cada producto toma la huella y el nombre canónico de la identidad mayoritaria de sus
// ofertas (mismo id y slug: el historial de la ficha sigue). Las ofertas que coinciden quedan `linked`; las demás
// las mueve el re-vínculo (`POST /v1/admin/pipeline/relink`) con PIPELINE_LINK=live. Uso:
//   bun scripts/reseed-products.ts <dir>           en seco: cifras y muestras en <dir>/reseed.json
//   bun scripts/reseed-products.ts <dir> --apply   escribe en D1

import { type Category, type IdentityValue, NORMALIZER_VERSION } from "@framerate/contracts";
import { searchText } from "@framerate/kit";
import { compare, type Fingerprint, fingerprintFromIdentity } from "@framerate/matching";
import { $ } from "bun";

const DB_DIR = new URL("../../../packages/database/", import.meta.url).pathname;

interface Row {
  listing_id: number;
  product_id: number;
  mpn: string | null;
  gtin: string | null;
  category: Category;
  brand: string | null;
  name: string;
  imp: string | null;
  confidence: "high" | "medium" | "low";
  identity: string;
  product_name: string;
  product_category: string;
}

async function d1<T>(sql: string): Promise<T[]> {
  const out = await $`bunx wrangler d1 execute framerate --remote --json --command ${sql}`.cwd(DB_DIR).quiet().text();
  return JSON.parse(out)[0].results as T[];
}

const sqlText = (v: string | null) => (v === null ? "NULL" : `'${v.replaceAll("'", "''")}'`);
const RANK = { high: 3, medium: 2, low: 1 } as const;

const [dir, flag] = process.argv.slice(2);
if (!dir) throw new Error("uso: reseed-products.ts <dir> [--apply]");

const rows = await d1<Row>(`SELECT l.id listing_id, l.product_id, l.mpn, l.gtin, i.category, i.brand, i.name,
  i.mpn imp, i.confidence, i.identity, p.name product_name, p.category product_category
  FROM listings l JOIN listing_identity i ON i.listing_id = l.id AND i.version = ${NORMALIZER_VERSION}
  JOIN products p ON p.id = l.product_id WHERE l.product_id IS NOT NULL`);

const byProduct = new Map<number, (Row & { fp: Fingerprint })[]>();
for (const r of rows) {
  const fp = fingerprintFromIdentity({
    identity: {
      category: r.category,
      brand: r.brand,
      name: r.name,
      mpn: r.imp,
      confidence: r.confidence,
      identity: JSON.parse(r.identity) as Record<string, IdentityValue>,
    },
    mpn: r.mpn,
    gtin: r.gtin,
  });
  const list = byProduct.get(r.product_id) ?? [];
  list.push({ ...r, fp });
  byProduct.set(r.product_id, list);
}

const at = new Date().toISOString();
const statements: string[] = [];
const agree: number[] = [];
const outliers: { product: string; listing: number; name: string; vetoes: string[] }[] = [];
const renamed: { from: string; to: string }[] = [];
let recategorized = 0;
for (const [productId, list] of byProduct) {
  // Representante: la huella más repetida entre las ofertas; empate → más confianza, después el id más bajo.
  const groups = new Map<string, typeof list>();
  for (const l of list) {
    const key = JSON.stringify([l.fp.category, l.fp.brand, l.fp.attributeKey, l.fp.attributes]);
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  const best = [...groups.values()].sort(
    (a, b) =>
      b.length - a.length ||
      Math.max(...b.map((l) => RANK[l.confidence])) - Math.max(...a.map((l) => RANK[l.confidence])) ||
      Math.min(...a.map((l) => l.listing_id)) - Math.min(...b.map((l) => l.listing_id)),
  )[0];
  const rep = best.sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || a.listing_id - b.listing_id)[0];
  for (const l of list) {
    const { vetoes } = compare(l.fp, rep.fp);
    if (vetoes.length === 0) agree.push(l.listing_id);
    else outliers.push({ product: rep.name, listing: l.listing_id, name: l.name, vetoes });
  }
  if (rep.name !== rep.product_name) renamed.push({ from: rep.product_name, to: rep.name });
  if (rep.fp.category !== rep.product_category) recategorized++;
  statements.push(
    `UPDATE products SET name = ${sqlText(rep.name)}, search = ${sqlText(searchText(rep.name))},
      brand = ${sqlText(rep.fp.brand)}, category = ${sqlText(rep.fp.category)},
      attributes = ${sqlText(JSON.stringify(rep.fp.attributes))}, attribute_key = ${sqlText(rep.fp.attributeKey)},
      updated_at = ${sqlText(at)} WHERE id = ${productId};`,
  );
}
for (let i = 0; i < agree.length; i += 500) {
  statements.push(`UPDATE listings SET norm_status = 'linked' WHERE id IN (${agree.slice(i, i + 500).join(",")});`);
}
statements.push(
  "INSERT INTO catalog_version (id, version) VALUES (1, 1) ON CONFLICT (id) DO UPDATE SET version = version + 1;",
);

const summary = {
  products: byProduct.size,
  listings: rows.length,
  agree: agree.length,
  outliers: outliers.length,
  renamed: renamed.length,
  recategorized,
};
await Bun.write(`${dir}/reseed.json`, JSON.stringify({ summary, outliers, renamed }, null, 1));
await Bun.write(`${dir}/reseed.sql`, statements.join("\n"));
console.log(JSON.stringify(summary));
if (flag === "--apply") {
  await $`bunx wrangler d1 execute framerate --remote --file ${dir}/reseed.sql --yes`.cwd(DB_DIR).quiet();
  console.log("aplicado");
}
