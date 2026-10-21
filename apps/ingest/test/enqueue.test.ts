import { describe, expect, test } from "bun:test";
import { requestCrawls } from "@/features/ingestion/runtime";
import { STORES } from "@/features/ingestion/stores/registry";
import { testEnv } from "./helpers";

/** El pedido de crawls que hace la API (RPC): valida y encola una tarea por (tienda, categoría) en su StoreCrawler. */

const totalJobs = STORES.filter((s) => !s.pausedReason).reduce(
  (n, s) => n + Object.values(s.adapter.categories).filter((slugs) => slugs?.length).length,
  0,
);

describe("requestCrawls", () => {
  test("sin filtro encola todas las tiendas y categorías que venden", async () => {
    const { env, tasks } = testEnv({} as D1Database);
    expect(await requestCrawls(env, { requestedBy: "admin:a" })).toEqual({ ok: true, enqueued: totalJobs });
    expect(tasks()).toHaveLength(totalJobs);
    expect(tasks().every((t) => t.requestedBy === "admin:a")).toBe(true);
  });

  test("pedir dos veces lo mismo encola una vez", async () => {
    const { env, tasks } = testEnv({} as D1Database);
    const request = { store: "tectec", category: "gpu" as const, requestedBy: "admin:a" };
    expect(await requestCrawls(env, request)).toEqual({ ok: true, enqueued: 1 });
    expect(await requestCrawls(env, request)).toEqual({ ok: true, enqueued: 0 });
    expect(tasks()).toHaveLength(1);
  });

  test("no encola las tiendas pausadas", async () => {
    const { env, tasks } = testEnv({} as D1Database);
    await requestCrawls(env, { requestedBy: "admin:a" });
    const paused = STORES.filter((s) => s.pausedReason).map((s) => s.slug);
    expect(tasks().some((t) => paused.includes(t.store))).toBe(false);
  });

  test("filtra por tienda y categoría", async () => {
    const { env, tasks } = testEnv({} as D1Database);
    expect(await requestCrawls(env, { store: "tectec", category: "gpu", requestedBy: "admin" })).toEqual({
      ok: true,
      enqueued: 1,
    });
    expect(tasks()).toEqual([{ store: "tectec", category: "gpu", requestedBy: "admin" }]);
  });

  test("una categoría que la tienda no vende no encola nada", async () => {
    const { env, tasks } = testEnv({} as D1Database);
    // Dust2 no vende discos duros.
    expect(await requestCrawls(env, { store: "dust2", category: "hdd", requestedBy: "admin" })).toEqual({
      ok: true,
      enqueued: 0,
    });
    expect(tasks()).toEqual([]);
  });

  test("tienda desconocida se rechaza sin encolar", async () => {
    const { env, tasks } = testEnv({} as D1Database);
    expect(await requestCrawls(env, { store: "no-existe", requestedBy: "admin" })).toEqual({
      ok: false,
      error: "unknown_store",
    });
    expect(tasks()).toEqual([]);
  });
});
