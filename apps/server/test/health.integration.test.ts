import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { HealthSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, seedCatalog, sessionHeaders, testEnv } from "./helpers";

/** Estado de los sistemas: qué falla o está atrasado, calculado al pedirlo. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
let seed: Awaited<ReturnType<typeof seedCatalog>>;

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
});
afterAll(() => dispose());
beforeEach(async () => {
  await resetD1(d1);
  seed = await seedCatalog(db);
});

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

async function health(actor: string | "anon" | "token") {
  const headers = new Headers();
  if (actor === "token") headers.set("authorization", `Bearer ${env.ADMIN_TOKEN}`);
  else if (actor !== "anon") for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
  return app.request("/v1/admin/health", { headers }, env);
}
const get = async () => HealthSchema.parse(await (await health("token")).json());
const system = (h: Awaited<ReturnType<typeof get>>, id: string) => h.systems.find((s) => s.id === id);

let runId = 0;
const run = (
  store_id: number,
  category: string,
  status: "running" | "succeeded" | "failed",
  startedAgo: number,
  extra: { finishedAgo?: number; error?: string; stats?: object } = {},
) =>
  db.query
    .insertInto("crawl_runs")
    .values({
      id: `run-${++runId}`,
      store_id,
      category,
      status,
      started_at: ago(startedAgo),
      finished_at: extra.finishedAgo === undefined ? null : ago(extra.finishedAgo),
      error: extra.error ?? null,
      stats: JSON.stringify(extra.stats ?? {}),
    })
    .execute();

describe("acceso", () => {
  test("sólo el personal: sin sesión 401, un usuario común 403, un moderador 200", async () => {
    expect((await health("anon")).status).toBe(401);
    const user = await createUser(env, db, { name: "Ana" });
    expect((await health(user)).status).toBe(403);
    const moderator = await createUser(env, db, { name: "Mod", role: "moderator" });
    expect((await health(moderator)).status).toBe(200);
  });

  test("sin nada fallando no hay incidencias y están los siete sistemas", async () => {
    const h = await get();
    expect(h.incidents).toEqual([]);
    expect(h.systems.map((s) => s.id)).toEqual([
      "scraping",
      "quarantine",
      "pipeline",
      "matching",
      "support",
      "moderation",
      "stores",
    ]);
    expect(h.systems.every((s) => s.attention === 0)).toBe(true);
  });
});

describe("pipeline", () => {
  const setStatus = (id: number, norm_status: "pending" | "normalized" | "failed", hoursAgo: number) =>
    db.query
      .updateTable("listings")
      .set({ norm_status, updated_at: ago(hoursAgo) })
      .where("id", "=", id)
      .execute();

  test("cuenta por estado y lo en camino; una pendiente de más de 2 h avisa y una fallida es error", async () => {
    await setStatus(seed.listings.l1, "pending", 3);
    await setStatus(seed.listings.l4, "pending", 1);
    const msi = await db.query
      .selectFrom("listings")
      .select("id")
      .where("external_id", "=", "2")
      .executeTakeFirstOrThrow();
    await setStatus(msi.id, "failed", 5);

    const h = await get();
    expect(system(h, "pipeline")).toMatchObject({ value: 2, attention: 2 });
    expect(h.pipeline.byStatus).toEqual({ legacy: 1, pending: 2, normalized: 0, linked: 0, fallback: 0, failed: 1 });
    expect(h.incidents.map((i) => [i.id, i.severity])).toEqual([
      ["pipeline:failed", "warning"],
      ["pipeline:pending", "warning"],
    ]);
    expect(h.incidents[1]?.detail).toBe("2 esperando, la más vieja hace 3 h");
    expect(h.incidents[1]?.href).toBe("/admin/estado?sistema=pipeline");

    // Con las pendientes recientes, nada que avisar.
    await setStatus(seed.listings.l1, "normalized", 1);
    await setStatus(msi.id, "pending", 1);
    const calm = await get();
    expect(calm.incidents).toEqual([]);
    expect(system(calm, "pipeline")?.value).toBe(3);
  });

  test("las ocultas se cuentan y avisan pasadas 24 h; la pausa global vigente es error", async () => {
    const oldest = ago(30);
    const pausedUntil = ago(-2);
    await db.query
      .updateTable("listings")
      .set({ visible: 0, first_seen_at: oldest })
      .where("id", "=", seed.listings.l1)
      .execute();
    await db.query
      .updateTable("listings")
      .set({ visible: 0, first_seen_at: ago(1) })
      .where("id", "=", seed.listings.l4)
      .execute();
    // `resetD1` vacía también la fila única que sembró la migración.
    const pause = (paused_until: string) =>
      db.query
        .insertInto("pipeline_state")
        .values({ id: 1, paused_until, updated_at: ago(0) })
        .onConflict((oc) => oc.column("id").doUpdateSet({ paused_until }))
        .execute();
    await pause(pausedUntil);

    const h = await get();
    expect(h.pipeline).toMatchObject({ hidden: 2, oldestHiddenAt: oldest, pausedUntil });
    expect(h.incidents.map((i) => [i.id, i.severity])).toEqual([
      ["pipeline:paused", "error"],
      ["pipeline:hidden", "warning"],
    ]);
    expect(h.incidents[1]?.detail).toBe("2 sin pasar el pipeline, la más vieja hace 30 h");

    // Una pausa que ya venció no es incidencia.
    await pause(ago(1));
    expect((await get()).incidents.map((i) => i.id)).toEqual(["pipeline:hidden"]);
  });

  test("gasto de IA por propósito, hoy y en el ciclo, con el tope de hoy y aviso al 90 %", async () => {
    // Nunca el día de hoy: si el ciclo empezara hoy, el gasto de su primera hora también sería "hoy".
    const cycleDay = String((new Date().getUTCDate() % 28) + 1);
    const budgetEnv = testEnv(d1, {}, { ANTHROPIC_MONTHLY_USD: "30", ANTHROPIC_CYCLE_DAY: cycleDay }).env;
    const withBudget = async () =>
      HealthSchema.parse(
        await (
          await app.request(
            "/v1/admin/health",
            { headers: { authorization: `Bearer ${budgetEnv.ADMIN_TOKEN}` } },
            budgetEnv,
          )
        ).json(),
      );
    const cycleStart = Date.parse((await withBudget()).pipeline.cycleStart);
    const usage = (purpose: "normalize" | "judge", at: string, usd: number) => ({
      at,
      worker: "normalize" as const,
      purpose,
      model: "claude-haiku-5-5",
      usd,
      status: "ok" as const,
    });
    await db.query
      .insertInto("ai_usage")
      .values([
        usage("normalize", new Date(Date.now() - 1000).toISOString(), 30),
        usage("normalize", new Date(cycleStart + 3_600_000).toISOString(), 1),
        usage("judge", new Date(cycleStart + 3_600_000).toISOString(), 0.2),
        // Del ciclo anterior: no cuenta.
        usage("judge", new Date(cycleStart - 3_600_000).toISOString(), 5),
      ])
      .execute();

    const h = await withBudget();
    expect(h.pipeline.aiUsage).toEqual([
      { purpose: "normalize", calls: 2, todayUsd: 30, cycleUsd: 31 },
      { purpose: "judge", calls: 1, todayUsd: 0, cycleUsd: 0.2 },
      { purpose: "extract", calls: 0, todayUsd: 0, cycleUsd: 0 },
    ]);
    // Quedaban $28,80 del ciclo al empezar el día, repartidos entre los días que faltan: menos que los $30 de hoy.
    expect(h.pipeline.dailyCapUsd).toBeGreaterThan(0);
    expect(h.pipeline.dailyCapUsd).toBeLessThanOrEqual(28.8);
    expect(h.incidents.map((i) => [i.id, i.severity])).toEqual([["pipeline:budget", "warning"]]);
    expect(h.incidents[0]?.detail).toMatch(/^\$30\.00 de \$\d+\.\d\d; \$31\.20 en el ciclo$/);

    // Sin tope configurado no hay con qué comparar: ni tope ni aviso.
    const plain = await get();
    expect(plain.pipeline.dailyCapUsd).toBeNull();
    expect(plain.incidents).toEqual([]);
  });
});

describe("scraping", () => {
  test("cuenta una corrida fallida, una sin corrida reciente y una atascada; la última corrida manda", async () => {
    // alfa/gpu: la última falló (y una anterior exitosa no la salva).
    await run(seed.alfa, "gpu", "succeeded", 10, { finishedAgo: 9.9 });
    await run(seed.alfa, "gpu", "failed", 2, { finishedAgo: 1.99, error: "HTTP 403 de la tienda" });
    // alfa/cpu: exitosa pero hace 20 h: atrasada.
    await run(seed.alfa, "cpu", "succeeded", 20, { finishedAgo: 19.9 });
    // beta/cpu: corriendo hace 90 min: atascada. Una anterior fallida ya no cuenta.
    await run(seed.beta, "cpu", "failed", 6, { finishedAgo: 5.9, error: "vieja" });
    await run(seed.beta, "cpu", "running", 1.5);
    // beta/gpu: exitosa hace 1 h: bien.
    await run(seed.beta, "gpu", "succeeded", 1, { finishedAgo: 0.99 });

    const h = await get();
    const scraping = h.incidents.filter((i) => i.system === "scraping");
    expect(scraping.map((i) => [i.id, i.severity])).toEqual([
      ["scraping:alfa:gpu:failed", "error"],
      ["scraping:alfa:cpu:stale", "warning"],
      ["scraping:beta:cpu:stuck", "warning"],
    ]);
    const failed = scraping[0];
    expect(failed?.detail).toContain("HTTP 403");
    expect(failed?.durationMs).toBeGreaterThan(0);
    expect(failed?.href).toBe("/tiendas/alfa");
    expect(system(h, "scraping")).toMatchObject({ value: 4, attention: 3 });
    // El historial va de la más antigua a la más nueva, con el estado de cada corrida.
    expect(system(h, "scraping")?.history?.at(-1)).toBe("succeeded");
    expect(system(h, "scraping")?.history).toContain("running");
  });

  test("una corrida exitosa que saltó la desactivación avisa; la siguiente corrida sana lo limpia", async () => {
    await run(seed.alfa, "gpu", "succeeded", 2, { finishedAgo: 1.9, stats: { deactivationSkipped: true } });
    const partial = (await get()).incidents.filter((i) => i.system === "scraping");
    expect(partial.map((i) => [i.id, i.severity])).toEqual([["scraping:alfa:gpu:partial", "warning"]]);

    await run(seed.alfa, "gpu", "succeeded", 1, { finishedAgo: 0.9, stats: { deactivationSkipped: false } });
    expect((await get()).incidents).toEqual([]);
  });

  test("una tienda que falló y no volvió a correr (pausada) es una sola advertencia, no una por categoría", async () => {
    await run(seed.alfa, "gpu", "failed", 72, { finishedAgo: 71.9, error: "HTTP 403 de la tienda" });
    await run(seed.alfa, "cpu", "failed", 72, { finishedAgo: 71.8, error: "HTTP 403 de la tienda" });
    const scraping = (await get()).incidents.filter((i) => i.system === "scraping");
    expect(scraping.map((i) => [i.id, i.severity])).toEqual([["scraping:alfa:not-crawled", "warning"]]);
    expect(scraping[0]?.detail).toContain("No corre hace 2 d");
    expect(scraping[0]?.detail).toContain("en 2 categorías: HTTP 403");
  });

  test("una tienda inactiva no cuenta", async () => {
    await db.query.updateTable("stores").set({ is_active: 0 }).where("id", "=", seed.alfa).execute();
    await run(seed.alfa, "gpu", "failed", 2, { finishedAgo: 1.9, error: "x" });
    expect((await get()).incidents).toEqual([]);
  });
});

describe("el resto de los sistemas", () => {
  test("la cuarentena cuenta lo de las últimas 24 h y no genera incidencias", async () => {
    await run(seed.alfa, "gpu", "succeeded", 1, { finishedAgo: 0.9 });
    const rowOf = (hours: number) => ({
      run_id: `run-${runId}`,
      store_id: seed.alfa,
      reason: "sin_precio",
      payload: "{}",
      created_at: ago(hours),
    });
    await db.query
      .insertInto("quarantine")
      .values([rowOf(2), rowOf(5), rowOf(48)])
      .execute();

    const h = await get();
    expect(system(h, "quarantine")).toMatchObject({ value: 2, attention: 0 });
    expect(h.incidents).toEqual([]);
  });

  test("matching, soporte y moderación avisan cuando algo espera más de 24 h", async () => {
    await db.query
      .insertInto("match_reviews")
      .values({ listing_id: seed.listings.l1, candidate_product_id: seed.asus, score: 0.8, created_at: ago(31) })
      .execute();
    await db.query
      .insertInto("support_tickets")
      .values([
        {
          public_id: "VIEJO00001",
          status: "open",
          user_id: null,
          email: "a@b.cl",
          category: "bug",
          subject: "Algo falla",
          access_token_hash: "h1",
          created_at: ago(40),
          updated_at: ago(30),
          last_message_at: ago(30),
        },
        {
          public_id: "NUEVO00002",
          status: "open",
          user_id: null,
          email: "c@d.cl",
          category: "bug",
          subject: "Reciente",
          access_token_hash: "h2",
          created_at: ago(2),
          updated_at: ago(2),
          last_message_at: ago(2),
        },
        {
          public_id: "CERRADO003",
          user_id: null,
          email: "e@f.cl",
          category: "bug",
          subject: "Resuelto",
          status: "resolved",
          closed_at: ago(1),
          access_token_hash: "h3",
          created_at: ago(50),
          updated_at: ago(1),
          last_message_at: ago(50),
        },
      ])
      .execute();
    await db.query
      .insertInto("reports")
      .values({ target_type: "product", target_id: "1", reason: "spam", created_at: ago(36) })
      .execute();

    const h = await get();
    expect(h.incidents.map((i) => [i.system, i.href])).toEqual([
      ["moderation", "/admin/moderation"],
      ["matching", "/admin/gatekeeper"],
      ["support", "/admin/support"],
    ]);
    expect(system(h, "matching")).toMatchObject({ value: 1, attention: 1 });
    expect(system(h, "support")).toMatchObject({ value: 2, attention: 1 });
    expect(system(h, "moderation")).toMatchObject({ value: 1, attention: 1 });
    expect(h.incidents.find((i) => i.system === "support")?.title).toBe("Algo falla");
  });

  test("una tienda congelada es un error; un reclamo con el DNS caído, una advertencia; los errores van primero", async () => {
    await db.query
      .updateTable("stores")
      .set({ frozen_at: ago(3) })
      .where("id", "=", seed.beta)
      .execute();
    await db.query
      .insertInto("store_claims")
      .values({
        store_id: seed.alfa,
        claimant_id: (await createUser(env, db, { name: "Duena" })) as string,
        domain: "alfa.cl",
        token: "tok",
        status: "stale",
        expires_at: ago(-100),
        created_at: ago(100),
        updated_at: ago(5),
      })
      .execute();

    const h = await get();
    expect(h.incidents.map((i) => [i.id, i.severity])).toEqual([
      [`stores:beta:frozen`, "error"],
      [`stores:alfa:stale-claim`, "warning"],
    ]);
    expect(system(h, "stores")).toMatchObject({ value: 2, attention: 2 });
  });
});
