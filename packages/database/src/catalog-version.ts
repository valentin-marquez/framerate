import { CompiledQuery } from "kysely";
import type { Db } from "./client";

/** Upsert: `resetD1` de los tests vacía la tabla, así que la fila no se puede dar por creada. */
export const bumpCatalogVersionQuery = CompiledQuery.raw(
  "INSERT INTO catalog_version (id, version) VALUES (1, 1) ON CONFLICT (id) DO UPDATE SET version = version + 1",
);

export async function bumpCatalogVersion(db: Db) {
  await db.batch([{ compile: () => bumpCatalogVersionQuery }]);
}

export async function catalogVersion(db: Db): Promise<number> {
  const row = await db.query.selectFrom("catalog_version").select("version").where("id", "=", 1).executeTakeFirst();
  return row?.version ?? 0;
}
