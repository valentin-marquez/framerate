import type { Category } from "@framerate/contracts";
import { silentLogger } from "@framerate/kit";
import { normalizeOffer } from "../src/features/ingestion/domain/normalize";
import { createHttpClient } from "../src/features/ingestion/stores/http";
import { findStore, STORES } from "../src/features/ingestion/stores/registry";

// Crawl real de una tienda pasado por `normalizeOffer`, sin base de datos: para evaluar una tienda antes de
// activarla. Uso: `bun run dry-run <tienda> [categoría]`.
const [slug, only] = process.argv.slice(2);
const store = slug ? findStore(slug) : undefined;
if (!store) {
  console.error(`Uso: bun run dry-run <tienda> [categoría]. Tiendas: ${STORES.map((s) => s.slug).join(", ")}`);
  process.exit(1);
}

const ctx = {
  http: createHttpClient({ minIntervalMs: store.minIntervalMs }),
  log: silentLogger,
  snapshot: async () => {},
};
const pct = (n: number, total: number) => `${total ? Math.round((100 * n) / total) : 0}%`;

for (const category of Object.keys(store.adapter.categories) as Category[]) {
  if (only && category !== only) continue;
  const quarantined = new Map<string, string[]>();
  const ids = new Set<string>();
  const unknownBrands = new Map<string, number>();
  const count = { valid: 0, mpn: 0, gtin: 0, brand: 0, card: 0, inStock: 0 };

  for await (const raw of store.adapter.crawlCategory(category, ctx)) {
    const result = normalizeOffer(raw, category);
    if (!result.ok) {
      const titles = quarantined.get(result.reason) ?? [];
      titles.push((raw as { title?: string }).title ?? "?");
      quarantined.set(result.reason, titles);
      continue;
    }
    const { offer } = result;
    if (ids.has(offer.externalId)) continue;
    ids.add(offer.externalId);
    count.valid++;
    if (offer.mpn) count.mpn++;
    if (offer.gtin) count.gtin++;
    if (offer.brand) count.brand++;
    else if (raw.brand) unknownBrands.set(raw.brand, (unknownBrands.get(raw.brand) ?? 0) + 1);
    if (offer.priceCard > offer.priceCash) count.card++;
    if (offer.inStock) count.inStock++;
  }

  const total = count.valid;
  console.log(
    `\n${category}: ${total} válidas (stock ${pct(count.inStock, total)}, MPN ${pct(count.mpn, total)}, ` +
      `GTIN ${pct(count.gtin, total)}, marca ${pct(count.brand, total)}, tarjeta > transferencia ${pct(count.card, total)})`,
  );
  if (unknownBrands.size) {
    console.log(`  marcas fuera del diccionario: ${[...unknownBrands].map(([b, n]) => `${b} (${n})`).join(", ")}`);
  }
  for (const [reason, titles] of quarantined) {
    console.log(`  cuarentena ${reason}: ${titles.length}`);
    for (const title of titles.slice(0, 4)) console.log(`    - ${title}`);
  }
}
