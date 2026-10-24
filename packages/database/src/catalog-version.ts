import { CompiledQuery } from "kysely";
import type { Db } from "./client";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Upsert: `resetD1` de los tests vacía la tabla, así que la fila no se puede dar por creada. */
export const bumpCatalogVersionQuery = CompiledQuery.raw(
  `INSERT INTO catalog_version (id, version, bumped_at) VALUES (1, 1, ${NOW})
   ON CONFLICT (id) DO UPDATE SET version = version + 1, bumped_at = ${NOW}`,
);

/**
 * La del refresco horario (#121): sólo si la última subida, de quien sea, tiene más de 15 min. Un precio que no la
 * sube se ve con la siguiente subida, que llega en minutos con el próximo crawl o refresco.
 */
export const throttledBumpCatalogVersionQuery = CompiledQuery.raw(
  `INSERT INTO catalog_version (id, version, bumped_at) VALUES (1, 1, ${NOW})
   ON CONFLICT (id) DO UPDATE SET version = version + 1, bumped_at = ${NOW}
   WHERE bumped_at IS NULL OR bumped_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes')`,
);

export async function bumpCatalogVersion(db: Db) {
  await db.batch([{ compile: () => bumpCatalogVersionQuery }]);
}

export async function catalogVersion(db: Db): Promise<number> {
  const row = await db.query.selectFrom("catalog_version").select("version").where("id", "=", 1).executeTakeFirst();
  return row?.version ?? 0;
}
