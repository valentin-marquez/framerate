import { tmpdir } from "node:os";
import type { Category } from "@framerate/contracts";
import { createTestD1 } from "@framerate/database/testing";
import { silentLogger, systemClock } from "@framerate/kit";
import { crawlCategory } from "../src/features/ingestion/crawl-category";
import { createHttpClient, type HttpClient, type HttpResponse } from "../src/features/ingestion/stores/http";
import { STORES } from "../src/features/ingestion/stores/registry";

// Corre el pipeline real (adaptador → normalize → matching) de varias tiendas contra una D1 en memoria y reporta
// cuánto se vincula entre tiendas y qué fusiones parecen sospechosas. Las respuestas HTTP quedan en un caché en
// disco para iterar sobre el matching sin volver a pedirle nada a las tiendas.
// Uso: `bun run match-report [tienda…] [--category gpu]`. Caché: $CRAWL_CACHE (por defecto en el tmp del sistema).
const args = process.argv.slice(2);
const categoryArg = args.includes("--category") ? (args[args.indexOf("--category") + 1] as Category) : undefined;
const slugs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--category");
const stores = STORES.filter((s) => !slugs.length || slugs.includes(s.slug));
const cacheDir = process.env.CRAWL_CACHE ?? `${tmpdir()}/framerate-crawl-cache`;

function cached(inner: HttpClient): HttpClient {
  async function through(key: string, request: () => Promise<HttpResponse>): Promise<HttpResponse> {
    const file = Bun.file(`${cacheDir}/${new Bun.CryptoHasher("sha1").update(key).digest("hex")}.json`);
    if (await file.exists()) {
      const hit = JSON.parse(await file.text());
      return { status: hit.status, headers: new Headers(hit.headers), text: hit.text };
    }
    const res = await request();
    await Bun.write(
      file,
      JSON.stringify({ status: res.status, headers: Object.fromEntries(res.headers), text: res.text }),
    );
    return res;
  }
  return {
    get: (url, init) => through(`GET ${url} ${JSON.stringify(init ?? {})}`, () => inner.get(url, init)),
    post: (url, json, init) =>
      through(`POST ${url} ${JSON.stringify(json)} ${JSON.stringify(init ?? {})}`, () => inner.post(url, json, init)),
  };
}

const { d1, db, dispose } = await createTestD1();
for (const store of stores) {
  const http = cached(createHttpClient({ minIntervalMs: store.minIntervalMs }));
  for (const category of Object.keys(store.adapter.categories) as Category[]) {
    if (categoryArg && category !== categoryArg) continue;
    const result = await crawlCategory(
      {
        db,
        clock: systemClock,
        log: silentLogger,
        newId: () => crypto.randomUUID(),
        createContext: () => ({ http, log: silentLogger, snapshot: async () => {} }),
      },
      store,
      category,
    );
    const { valid, quarantined, linked, newProducts, reviews } = result.stats;
    console.log(
      `${store.slug}/${category}: ${result.status} válidas=${valid} cuarentena=${quarantined} vinculadas=${linked} nuevas=${newProducts} revisión=${reviews}${result.error ? ` (${result.error})` : ""}`,
    );
  }
}

const rows = <T>(sql: string) =>
  d1
    .prepare(sql)
    .all<T>()
    .then((r) => r.results);

console.log("\n== Productos con ofertas de 2 o más tiendas, por categoría");
console.table(
  await rows(`
    SELECT category, COUNT(*) AS productos, SUM(tiendas >= 2) AS multi_tienda,
           ROUND(100.0 * SUM(tiendas >= 2) / COUNT(*), 1) AS pct
    FROM (SELECT p.category, COUNT(DISTINCT l.store_id) AS tiendas
          FROM products p JOIN listings l ON l.product_id = p.id AND l.is_active = 1 GROUP BY p.id)
    GROUP BY category ORDER BY category`),
);

console.log("== Cómo se decidió cada oferta");
console.table(await rows("SELECT method, COUNT(*) AS n FROM match_decisions GROUP BY method ORDER BY n DESC"));
console.log(
  `Revisiones pendientes: ${(await rows<{ n: number }>("SELECT COUNT(*) AS n FROM match_reviews WHERE status = 'pending'"))[0]?.n}`,
);

// Precios muy distintos dentro de un producto suelen delatar una fusión errónea (o una oferta mal parseada). Sólo
// ofertas con stock: las agotadas conservan precios viejos.
console.log("\n== Sospechosos: transferencia máxima / mínima > 1,5 entre ofertas con stock de un producto");
const suspects = await rows<{ id: number; name: string; ratio: number }>(`
  SELECT p.id, p.name, ROUND(1.0 * MAX(l.price_cash) / MIN(l.price_cash), 2) AS ratio
  FROM products p JOIN listings l ON l.product_id = p.id AND l.is_active = 1 AND l.in_stock = 1
  GROUP BY p.id HAVING COUNT(DISTINCT l.store_id) >= 2 AND ratio > 1.5 ORDER BY ratio DESC LIMIT 15`);
for (const s of suspects) {
  console.log(`\n#${s.id} ${s.name} (×${s.ratio})`);
  const offers = await rows<{ slug: string; title: string; price_cash: number; mpn: string | null }>(`
    SELECT st.slug, l.title, l.price_cash, l.mpn FROM listings l JOIN stores st ON st.id = l.store_id
    WHERE l.product_id = ${s.id} AND l.is_active = 1 AND l.in_stock = 1`);
  for (const o of offers)
    console.log(`   ${o.slug.padEnd(14)} ${String(o.price_cash).padStart(9)}  ${o.mpn ?? "-"}  ${o.title}`);
}

// Dos ofertas de la misma tienda en un producto: variantes (color, revisión) fusionadas o una fusión errónea.
console.log("\n== Productos con 2 o más ofertas de la MISMA tienda");
const sameStore = await rows<{ id: number; name: string; store_id: number; n: number }>(`
  SELECT p.id, p.name, l.store_id, COUNT(*) AS n FROM products p JOIN listings l ON l.product_id = p.id AND l.is_active = 1
  GROUP BY p.id, l.store_id HAVING n >= 2 ORDER BY n DESC`);
console.log(`Total: ${sameStore.length}`);
for (const s of sameStore.slice(0, 15)) {
  const offers = await rows<{ title: string; price_cash: number; mpn: string | null }>(`
    SELECT title, price_cash, mpn FROM listings WHERE product_id = ${s.id} AND store_id = ${s.store_id} AND is_active = 1`);
  console.log(`\n#${s.id} ${s.name}`);
  for (const o of offers) console.log(`   ${String(o.price_cash).padStart(9)}  ${o.mpn ?? "-"}  ${o.title}`);
}

console.log("\n== Muestra de productos multi-tienda");
const sample = await rows<{ id: number; name: string }>(`
  SELECT p.id, p.name FROM products p JOIN listings l ON l.product_id = p.id AND l.is_active = 1
  GROUP BY p.id HAVING COUNT(DISTINCT l.store_id) >= 3 ORDER BY RANDOM() LIMIT 8`);
for (const s of sample) {
  const titles = await rows<{ slug: string; title: string }>(`
    SELECT st.slug, l.title FROM listings l JOIN stores st ON st.id = l.store_id WHERE l.product_id = ${s.id}`);
  console.log(`\n#${s.id} ${s.name}`);
  for (const t of titles) console.log(`   ${t.slug.padEnd(14)} ${t.title}`);
}

await dispose();
