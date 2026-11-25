import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import { silentLogger } from "@framerate/kit";
import { CRAWL_PERIOD_MS, nextSlot, REFRESH_PERIOD_MS, storeOffset } from "./agenda";
import {
  type AlarmDeps,
  completeTask,
  type DispatchedTask,
  enqueueCrawls,
  ensureSchedule,
  initSchema,
  LEASE_MS,
  nextWake,
  runAlarmStep,
  type Sql,
} from "./coordinator";

const MIN = 60_000;

function setup() {
  const db = new Database(":memory:");
  const sql: Sql = (query, ...params) => db.query(query).all(...params) as never;
  initSchema(sql);
  let t = Date.parse("2026-10-20T00:00:00Z");
  const dispatched: DispatchedTask[] = [];
  const closed: string[] = [];
  let dispatchError: Error | null = null;
  let n = 0;
  const deps: AlarmDeps = {
    slug: "tienda",
    categories: ["gpu", "cpu"],
    now: () => t,
    newId: () => `run-${++n}`,
    refreshable: false,
    dispatch: async (task) => {
      if (dispatchError) throw dispatchError;
      dispatched.push(task);
    },
    closeRun: async (runId) => {
      closed.push(runId);
    },
    log: silentLogger,
  };
  const tasks = () => sql("SELECT key, status, attempts, not_before FROM tasks ORDER BY rowid");
  return {
    sql,
    deps,
    closed,
    tasks,
    /** Lo despachado, como categoría o `refresh`. */
    get crawled(): Array<Category | "refresh"> {
      return dispatched.map((d) => d.category ?? "refresh");
    },
    get now() {
      return t;
    },
    advance: (ms: number) => {
      t += ms;
    },
    /** El aviso del consumer para la última tarea despachada. */
    finish: (failed = false) => {
      const last = dispatched.at(-1) as DispatchedTask;
      completeTask(sql, last.key, last.runId, failed, t, silentLogger);
    },
    failDispatch: (error: Error | null) => {
      dispatchError = error;
    },
  };
}

describe("coordinador por tienda", () => {
  test("pedir dos veces la misma categoría encola una", () => {
    const { sql, tasks, now } = setup();
    expect(enqueueCrawls(sql, ["gpu"], "admin:a", now)).toBe(1);
    expect(enqueueCrawls(sql, ["gpu", "cpu"], "cron", now)).toBe(1);
    expect(tasks().map((r) => r.key)).toEqual(["crawl:gpu", "crawl:cpu"]);
  });

  test("despacha una tarea a la vez, en orden de llegada, y el aviso de éxito la borra", async () => {
    const s = setup();
    enqueueCrawls(s.sql, ["cpu", "gpu"], "admin:a", s.now);
    // Con una en curso sólo espera su lease, no las pendientes.
    expect(await runAlarmStep(s.sql, s.deps)).toBe(s.now + LEASE_MS);
    expect(s.crawled).toEqual(["cpu"]);
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toEqual(["cpu"]);
    s.finish();
    expect(s.tasks().map((r) => r.key)).toEqual(["crawl:gpu"]);
    expect(nextWake(s.sql, s.now)).toBe(s.now);
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toEqual(["cpu", "gpu"]);
    s.finish();
    expect(await runAlarmStep(s.sql, s.deps)).toBeNull();
  });

  test("un fallo reintenta con demora y al tercero se descarta", async () => {
    const s = setup();
    enqueueCrawls(s.sql, ["gpu"], "cron", s.now);
    await runAlarmStep(s.sql, s.deps);
    s.finish(true);
    expect(s.tasks()[0]).toMatchObject({ status: "pending", attempts: 1 });
    expect(nextWake(s.sql, s.now)).toBe(s.now + 5 * MIN);
    // Antes de la demora no despacha.
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toHaveLength(1);
    s.advance(5 * MIN);
    await runAlarmStep(s.sql, s.deps);
    s.finish(true);
    expect(nextWake(s.sql, s.now)).toBe(s.now + 10 * MIN);
    s.advance(10 * MIN);
    await runAlarmStep(s.sql, s.deps);
    s.finish(true);
    expect(s.crawled).toHaveLength(3);
    expect(s.tasks()).toEqual([]);
  });

  test("un lease vencido cierra la corrida como interrumpida y su aviso tardío se ignora", async () => {
    const s = setup();
    enqueueCrawls(s.sql, ["gpu"], "cron", s.now);
    await runAlarmStep(s.sql, s.deps);
    s.advance(LEASE_MS);
    expect(await runAlarmStep(s.sql, s.deps)).toBe(s.now + 5 * MIN);
    expect(s.closed).toEqual(["run-1"]);
    expect(s.tasks()[0]).toMatchObject({ status: "pending", attempts: 1 });
    s.finish();
    expect(s.tasks()[0]).toMatchObject({ status: "pending", attempts: 1 });
  });

  test("si no se puede despachar, cuenta como fallo", async () => {
    const s = setup();
    enqueueCrawls(s.sql, ["gpu"], "cron", s.now);
    s.failDispatch(new Error("cola caída"));
    expect(await runAlarmStep(s.sql, s.deps)).toBe(s.now + 5 * MIN);
    expect(s.tasks()[0]).toMatchObject({ status: "pending", attempts: 1 });
  });

  test("al vencer el slot encola todas sus categorías y agenda el siguiente", async () => {
    const s = setup();
    ensureSchedule(s.sql, "tienda", s.now, false);
    const slot = nextSlot(s.now, CRAWL_PERIOD_MS, storeOffset("tienda", CRAWL_PERIOD_MS));
    expect(nextWake(s.sql, s.now)).toBe(slot);
    s.advance(slot - s.now);
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toEqual(["gpu"]);
    s.finish();
    expect(s.tasks().map((r) => r.key)).toEqual(["crawl:cpu"]);
    expect(s.sql("SELECT next_at FROM schedule")[0]?.next_at).toBe(slot + CRAWL_PERIOD_MS);
    // Un slot ya creado no se mueve.
    ensureSchedule(s.sql, "tienda", s.now, false);
    expect(s.sql("SELECT next_at FROM schedule")[0]?.next_at).toBe(slot + CRAWL_PERIOD_MS);
  });

  test("el refresco vence cada hora y pasa antes que los crawls encolados", async () => {
    const s = setup();
    const deps = { ...s.deps, refreshable: true };
    enqueueCrawls(s.sql, ["gpu"], "admin:a", s.now);
    ensureSchedule(s.sql, "tienda", s.now, true);
    const slot = nextSlot(s.now, REFRESH_PERIOD_MS, storeOffset("tienda", REFRESH_PERIOD_MS));
    s.advance(slot - s.now);
    await runAlarmStep(s.sql, deps);
    expect(s.crawled).toEqual(["refresh"]);
    expect(s.sql("SELECT next_at FROM schedule WHERE kind = 'refresh'")[0]?.next_at).toBe(slot + REFRESH_PERIOD_MS);
    s.finish();
    await runAlarmStep(s.sql, deps);
    expect(s.crawled).toEqual(["refresh", "gpu"]);
  });

  test("un refresco fallido o interrumpido no se reintenta: vuelve con el próximo slot", async () => {
    const s = setup();
    const deps = { ...s.deps, refreshable: true };
    s.sql(
      "INSERT INTO tasks (key, kind, requested_by, requested_at, not_before) VALUES ('refresh', 'refresh', 'schedule', 0, 0)",
    );
    await runAlarmStep(s.sql, deps);
    s.finish(true);
    expect(s.tasks()).toEqual([]);
    s.sql(
      "INSERT INTO tasks (key, kind, requested_by, requested_at, not_before, status, run_id) VALUES ('refresh', 'refresh', 'schedule', 0, 0, 'running', 'muerta')",
    );
    await runAlarmStep(s.sql, deps);
    expect(s.closed).toEqual(["muerta"]);
    expect(s.tasks()).toEqual([]);
  });

  test("una tienda que deja de saber refrescar pierde su slot y su tarea de refresco", async () => {
    const s = setup();
    ensureSchedule(s.sql, "tienda", s.now, true);
    s.sql(
      "INSERT INTO tasks (key, kind, requested_by, requested_at, not_before) VALUES ('refresh', 'refresh', 'schedule', 0, 0)",
    );
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toEqual([]);
    expect(s.tasks()).toEqual([]);
    expect(s.sql("SELECT kind FROM schedule")).toEqual([{ kind: "crawl" }]);
  });

  test("una tienda pausada borra sus tareas y no reprograma", async () => {
    const s = setup();
    enqueueCrawls(s.sql, ["gpu"], "cron", s.now);
    expect(await runAlarmStep(s.sql, { ...s.deps, categories: null })).toBeNull();
    expect(s.crawled).toEqual([]);
    expect(s.tasks()).toEqual([]);
  });
});
