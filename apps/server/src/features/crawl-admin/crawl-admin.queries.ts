import { type Db, parseJson } from "@framerate/database";

/** Lectura del estado de la ingesta (historial de corridas y cuarentena). Sólo consulta; escribe `ingest`. */

export async function listRuns(db: Db, limit: number) {
  const rows = await db.query
    .selectFrom("crawl_runs as r")
    .innerJoin("stores as s", "s.id", "r.store_id")
    .select([
      "r.id",
      "s.slug as store",
      "r.category",
      "r.status",
      "r.started_at as startedAt",
      "r.finished_at as finishedAt",
      "r.stats",
      "r.error",
    ])
    .orderBy("r.started_at", "desc")
    .limit(limit)
    .execute();
  return rows.map((r) => ({ ...r, stats: parseJson<Record<string, unknown>>(r.stats, {}) }));
}

export async function listQuarantine(db: Db, filter: { runId?: string; limit: number }) {
  let query = db.query
    .selectFrom("quarantine as q")
    .innerJoin("stores as s", "s.id", "q.store_id")
    .select([
      "q.id",
      "q.run_id as runId",
      "s.slug as store",
      "q.external_id as externalId",
      "q.reason",
      "q.payload",
      "q.created_at as createdAt",
    ])
    .orderBy("q.id", "desc")
    .limit(filter.limit);
  if (filter.runId) query = query.where("q.run_id", "=", filter.runId);
  const rows = await query.execute();
  return rows.map((r) => ({ ...r, payload: parseJson<unknown>(r.payload, null) }));
}
