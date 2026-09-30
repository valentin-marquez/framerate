import { describe, expect, test } from "bun:test";
import { requestCrawls } from "@/features/ingestion/runtime";
import { STORES } from "@/features/ingestion/stores/registry";
import { testEnv } from "./helpers";

/** El pedido de crawls que hace la API (RPC) y el cron: valida y encola un mensaje por (tienda, categoría). */

const totalJobs = STORES.reduce(
  (n, s) => n + Object.values(s.adapter.categories).filter((slugs) => slugs?.length).length,
  0,
);

describe("requestCrawls", () => {
  test("sin filtro encola todas las tiendas y categorías que venden", async () => {
    const { env, sent } = testEnv({} as D1Database);
    const result = await requestCrawls(env, { requestedBy: "cron" });
    expect(result).toEqual({ ok: true, enqueued: totalJobs });
    expect(sent).toHaveLength(totalJobs);
    expect(sent.every((m) => m.type === "crawl.category" && m.requestedBy === "cron")).toBe(true);
  });

  test("filtra por tienda y categoría", async () => {
    const { env, sent } = testEnv({} as D1Database);
    expect(await requestCrawls(env, { store: "tectec", category: "gpu", requestedBy: "admin" })).toEqual({
      ok: true,
      enqueued: 1,
    });
    expect(sent[0]).toMatchObject({ store: "tectec", category: "gpu", requestedBy: "admin" });
  });

  test("una categoría que la tienda no vende no encola nada", async () => {
    const { env, sent } = testEnv({} as D1Database);
    // Dust2 no vende discos duros.
    expect(await requestCrawls(env, { store: "dust2", category: "hdd", requestedBy: "admin" })).toEqual({
      ok: true,
      enqueued: 0,
    });
    expect(sent).toEqual([]);
  });

  test("tienda desconocida se rechaza sin encolar", async () => {
    const { env, sent } = testEnv({} as D1Database);
    expect(await requestCrawls(env, { store: "no-existe", requestedBy: "admin" })).toEqual({
      ok: false,
      error: "unknown_store",
    });
    expect(sent).toEqual([]);
  });
});
