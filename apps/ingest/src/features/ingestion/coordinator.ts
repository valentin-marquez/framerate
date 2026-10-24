import type { Category } from "@framerate/contracts";
import type { Logger } from "@framerate/kit";
import { CRAWL_PERIOD_MS, MAX_ATTEMPTS, nextSlot, REFRESH_PERIOD_MS, retryDelay, storeOffset } from "./agenda";
import type { CrawlResult } from "./crawl-category";

/**
 * Cola y agenda de una tienda (#121, spec #201). El mismo SQL corre sobre `ctx.storage.sql` en el Durable Object
 * y sobre `bun:sqlite` en los tests, así lo frágil (tarea muerta, reintento, descarte) queda probado sin el runtime.
 */
export type SqlValue = string | number | null;
export type Sql = (query: string, ...params: SqlValue[]) => Record<string, SqlValue>[];

export function initSchema(sql: Sql) {
  sql(`CREATE TABLE IF NOT EXISTS tasks (
    key          TEXT PRIMARY KEY,
    kind         TEXT NOT NULL,
    category     TEXT,
    requested_by TEXT NOT NULL,
    requested_at INTEGER NOT NULL,
    not_before   INTEGER NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'pending',
    run_id       TEXT
  )`);
  sql("CREATE TABLE IF NOT EXISTS schedule (kind TEXT PRIMARY KEY, next_at INTEGER NOT NULL)");
}

/** Dos pedidos de la misma categoría son una tarea (#104). Devuelve cuántas son nuevas. */
export function enqueueCrawls(sql: Sql, categories: readonly Category[], requestedBy: string, now: number): number {
  let queued = 0;
  for (const category of categories) {
    queued += sql(
      `INSERT INTO tasks (key, kind, category, requested_by, requested_at, not_before)
       VALUES (?, 'crawl', ?, ?, ?, 0) ON CONFLICT DO NOTHING RETURNING key`,
      `crawl:${category}`,
      category,
      requestedBy,
      now,
    ).length;
  }
  return queued;
}

/**
 * Crea los slots que falten; uno que ya existe (aunque esté vencido) no se toca. El de refresco sólo si el adaptador
 * sabe refrescar: los DO creados antes de la fase 2 lo ganan con el Cron horario.
 */
export function ensureSchedule(sql: Sql, slug: string, now: number, refreshable: boolean) {
  sql(
    "INSERT INTO schedule (kind, next_at) VALUES ('crawl', ?) ON CONFLICT DO NOTHING",
    nextSlot(now, CRAWL_PERIOD_MS, storeOffset(slug, CRAWL_PERIOD_MS)),
  );
  if (refreshable) {
    sql(
      "INSERT INTO schedule (kind, next_at) VALUES ('refresh', ?) ON CONFLICT DO NOTHING",
      nextSlot(now, REFRESH_PERIOD_MS, storeOffset(slug, REFRESH_PERIOD_MS)),
    );
  } else {
    sql("DELETE FROM schedule WHERE kind = 'refresh'");
  }
}

/** El próximo despertar: la tarea pendiente o el slot más cercano, nunca antes de `now`. `null` si no hay nada. */
export function nextWake(sql: Sql, now: number): number | null {
  const [row] = sql(
    `SELECT MIN(t) AS t FROM (
       SELECT MIN(not_before) AS t FROM tasks WHERE status = 'pending'
       UNION ALL SELECT next_at FROM schedule
     )`,
  );
  return row?.t == null ? null : Math.max(now, Number(row.t));
}

export interface AlarmDeps {
  slug: string;
  /** Categorías que vende la tienda; `null` si ya no existe o está pausada. */
  categories: readonly Category[] | null;
  now(): number;
  newId(): string;
  crawl(category: Category, runId: string): Promise<Pick<CrawlResult, "status">>;
  /** Refresco liviano de la tienda; `null` si su adaptador no lo implementa. */
  refresh: ((runId: string) => Promise<Pick<CrawlResult, "status">>) | null;
  /** Cierra como fallida una corrida que quedó `running` porque el Worker murió a mitad. */
  closeRun(runId: string): Promise<void>;
  log: Logger;
}

/** Una alarm: a lo más una tarea, en serie (#32). Devuelve cuándo despertar de nuevo, o `null` para no hacerlo. */
export async function runAlarmStep(sql: Sql, deps: AlarmDeps): Promise<number | null> {
  const { log } = deps;
  if (!deps.categories) {
    // Al despausarla, el Cron horario la revive con `ensureScheduled`.
    sql("DELETE FROM tasks");
    log.info("coordinator.paused");
    return null;
  }
  try {
    for (const task of sql("SELECT key, kind, run_id, attempts FROM tasks WHERE status = 'running'")) {
      log.warn("coordinator.interrupted", { key: task.key, runId: task.run_id });
      if (task.run_id) await deps.closeRun(String(task.run_id));
      settleFailure(sql, String(task.key), String(task.kind), Number(task.attempts) + 1, deps.now(), log);
    }

    const now = deps.now();
    const [slot] = sql("SELECT next_at FROM schedule WHERE kind = 'crawl'");
    if (slot && now >= Number(slot.next_at)) {
      enqueueCrawls(sql, deps.categories, "schedule", now);
      sql(
        "UPDATE schedule SET next_at = ? WHERE kind = 'crawl'",
        nextSlot(now + 1, CRAWL_PERIOD_MS, storeOffset(deps.slug, CRAWL_PERIOD_MS)),
      );
    }
    const [refreshSlot] = sql("SELECT next_at FROM schedule WHERE kind = 'refresh'");
    if (!deps.refresh) {
      sql("DELETE FROM schedule WHERE kind = 'refresh'");
      sql("DELETE FROM tasks WHERE kind = 'refresh'");
    } else if (refreshSlot && now >= Number(refreshSlot.next_at)) {
      sql(
        `INSERT INTO tasks (key, kind, requested_by, requested_at, not_before)
         VALUES ('refresh', 'refresh', 'schedule', ?, 0) ON CONFLICT DO NOTHING`,
        now,
      );
      sql(
        "UPDATE schedule SET next_at = ? WHERE kind = 'refresh'",
        nextSlot(now + 1, REFRESH_PERIOD_MS, storeOffset(deps.slug, REFRESH_PERIOD_MS)),
      );
    }

    // El refresco primero: dura ~1 min y es la promesa de frescura; un ciclo de crawls en serie puede durar 40.
    const [task] = sql(
      `SELECT key, kind, category, attempts FROM tasks WHERE status = 'pending' AND not_before <= ?
       ORDER BY kind = 'refresh' DESC, rowid LIMIT 1`,
      now,
    );
    if (task) {
      const key = String(task.key);
      const runId = deps.newId();
      sql("UPDATE tasks SET status = 'running', run_id = ? WHERE key = ?", runId, key);
      log.info("coordinator.task_started", { key, attempts: task.attempts, runId });
      let failed: boolean;
      try {
        const run =
          task.kind === "refresh" && deps.refresh ? deps.refresh(runId) : deps.crawl(task.category as Category, runId);
        failed = (await run).status === "failed";
      } catch (error) {
        log.error("coordinator.task_failed", { key, error });
        failed = true;
      }
      if (failed) settleFailure(sql, key, String(task.kind), Number(task.attempts) + 1, deps.now(), log);
      else sql("DELETE FROM tasks WHERE key = ?", key);
    }
  } catch (error) {
    // La alarm no deja escapar errores: el reintento de la plataforma queda para cuando el Worker muere.
    log.error("coordinator.step_failed", { error });
  }
  const wake = nextWake(sql, deps.now());
  log.info("coordinator.scheduled", { nextWake: wake === null ? null : new Date(wake).toISOString() });
  return wake;
}

function settleFailure(sql: Sql, key: string, kind: string, attempts: number, now: number, log: Logger) {
  // El refresco no se reintenta: en una hora vuelve solo, y reintentarlo correría detrás de los crawls.
  if (kind === "refresh" || attempts >= MAX_ATTEMPTS) {
    sql("DELETE FROM tasks WHERE key = ?", key);
    log.warn("coordinator.task_dropped", { key, attempts });
    return;
  }
  sql(
    "UPDATE tasks SET status = 'pending', run_id = NULL, attempts = ?, not_before = ? WHERE key = ?",
    attempts,
    now + retryDelay(attempts),
    key,
  );
}
