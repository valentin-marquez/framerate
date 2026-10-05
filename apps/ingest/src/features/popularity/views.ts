import { bumpCatalogVersionQuery, type Db } from "@framerate/database";
import { CompiledQuery } from "kysely";

// `_sample_interval`: Analytics Engine muestrea con mucho tráfico; cada fila vale por las que representa.
const VIEWS_7D_SQL = `SELECT blob2 AS slug, SUM(_sample_interval) AS views FROM framerate_events
WHERE blob1 = 'view' AND timestamp > NOW() - INTERVAL '7' DAY GROUP BY slug FORMAT JSON`;

/** Vistas de ficha de los últimos 7 días por slug, desde el dataset que escribe apps/server. */
export async function fetchViews7d(accountId: string, token: string, fetcher: typeof fetch = fetch) {
  const res = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: VIEWS_7D_SQL,
  });
  if (!res.ok) throw new Error(`analytics_engine ${res.status}: ${await res.text()}`);
  const { data } = (await res.json()) as { data: { slug: string; views: number | string }[] };
  return data.map((r): [string, number] => [r.slug, Number(r.views)]);
}

/** Reemplaza `views_7d` de todo el catálogo (los slugs que no existen no cruzan) y sube la versión del catálogo. */
export async function applyViews7d(db: Db, views: [string, number][]) {
  await db.batch(
    [
      CompiledQuery.raw("UPDATE products SET views_7d = 0 WHERE views_7d <> 0"),
      CompiledQuery.raw(
        `UPDATE products SET views_7d = j.value ->> '$[1]' FROM json_each(?1) j WHERE products.slug = j.value ->> '$[0]'`,
        [JSON.stringify(views)],
      ),
      bumpCatalogVersionQuery,
    ].map((q) => ({ compile: () => q })),
  );
  return { products: views.length };
}
