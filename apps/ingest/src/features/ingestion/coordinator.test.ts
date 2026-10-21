import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import { silentLogger } from "@framerate/kit";
import { CRAWL_PERIOD_MS, nextSlot, storeOffset } from "./agenda";
import {
  type AlarmDeps,
  enqueueCrawls,
  ensureSchedule,
  initSchema,
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
  const crawled: Category[] = [];
  const closed: string[] = [];
  let outcome: "succeeded" | "failed" | Error = "succeeded";
  let n = 0;
  const deps: AlarmDeps = {
    slug: "tienda",
    categories: ["gpu", "cpu"],
    now: () => t,
    newId: () => `run-${++n}`,
    crawl: async (category) => {
      crawled.push(category);
      if (outcome instanceof Error) throw outcome;
      return { status: outcome };
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
    crawled,
    closed,
    tasks,
    get now() {
      return t;
    },
    advance: (ms: number) => {
      t += ms;
    },
    result: (next: typeof outcome) => {
      outcome = next;
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

  test("una tarea por alarm, en orden de llegada, y el éxito la borra", async () => {
    const s = setup();
    enqueueCrawls(s.sql, ["cpu", "gpu"], "admin:a", s.now);
    expect(await runAlarmStep(s.sql, s.deps)).toBe(s.now);
    expect(s.crawled).toEqual(["cpu"]);
    expect(s.tasks().map((r) => r.key)).toEqual(["crawl:gpu"]);
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toEqual(["cpu", "gpu"]);
    expect(await runAlarmStep(s.sql, s.deps)).toBeNull();
  });

  test("un fallo reintenta con demora y al tercero se descarta", async () => {
    const s = setup();
    s.result("failed");
    enqueueCrawls(s.sql, ["gpu"], "cron", s.now);
    expect(await runAlarmStep(s.sql, s.deps)).toBe(s.now + 5 * MIN);
    expect(s.tasks()[0]).toMatchObject({ status: "pending", attempts: 1 });
    // Antes de la demora no corre.
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toHaveLength(1);
    s.advance(5 * MIN);
    s.result(new Error("red"));
    expect(await runAlarmStep(s.sql, s.deps)).toBe(s.now + 10 * MIN);
    s.advance(10 * MIN);
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toHaveLength(3);
    expect(s.tasks()).toEqual([]);
  });

  test("una tarea que quedó running se cierra como interrumpida y vuelve a pending", async () => {
    const s = setup();
    enqueueCrawls(s.sql, ["gpu"], "cron", s.now);
    s.sql("UPDATE tasks SET status = 'running', run_id = 'muerta'");
    expect(await runAlarmStep(s.sql, s.deps)).toBe(s.now + 5 * MIN);
    expect(s.closed).toEqual(["muerta"]);
    expect(s.crawled).toEqual([]);
    expect(s.tasks()[0]).toMatchObject({ status: "pending", attempts: 1 });
  });

  test("al vencer el slot encola todas sus categorías y agenda el siguiente", async () => {
    const s = setup();
    ensureSchedule(s.sql, "tienda", s.now);
    const slot = nextSlot(s.now, CRAWL_PERIOD_MS, storeOffset("tienda", CRAWL_PERIOD_MS));
    expect(nextWake(s.sql, s.now)).toBe(slot);
    s.advance(slot - s.now);
    await runAlarmStep(s.sql, s.deps);
    expect(s.crawled).toEqual(["gpu"]);
    expect(s.tasks().map((r) => r.key)).toEqual(["crawl:cpu"]);
    expect(s.sql("SELECT next_at FROM schedule")[0]?.next_at).toBe(slot + CRAWL_PERIOD_MS);
    // Un slot ya creado no se mueve.
    ensureSchedule(s.sql, "tienda", s.now);
    expect(s.sql("SELECT next_at FROM schedule")[0]?.next_at).toBe(slot + CRAWL_PERIOD_MS);
  });

  test("una tienda pausada borra sus tareas y no reprograma", async () => {
    const s = setup();
    enqueueCrawls(s.sql, ["gpu"], "cron", s.now);
    expect(await runAlarmStep(s.sql, { ...s.deps, categories: null })).toBeNull();
    expect(s.crawled).toEqual([]);
    expect(s.tasks()).toEqual([]);
  });
});
