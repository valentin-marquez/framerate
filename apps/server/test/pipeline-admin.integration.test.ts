import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ApiErrorSchema, type EnqueuePipelineResult, PipelineShadowReportSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { seedCatalog, testEnv } from "./helpers";

/** Administración del pipeline (#153): encolar por RPC a ingest y leer el vínculo en sombra. */

let db: Db;
let dispose: () => Promise<void>;
let env: Env;
let pipelineRequests: ReturnType<typeof testEnv>["pipelineRequests"];
let seed: Awaited<ReturnType<typeof seedCatalog>>;
let refuse: Exclude<EnqueuePipelineResult, { ok: true }>["error"] | null = null;
const app = createApp();
const auth = { authorization: "Bearer test-admin-token", "content-type": "application/json" };
const post = (path: string, body: unknown, headers: Record<string, string> = auth) =>
  app.request(path, { method: "POST", headers, body: JSON.stringify(body) }, env);
const get = (path: string) => app.request(path, { headers: auth }, env);

beforeAll(async () => {
  let d1: D1Database;
  ({ d1, db, dispose } = await createTestD1());
  ({ env, pipelineRequests } = testEnv(d1, {
    enqueuePipeline: async (request) => {
      pipelineRequests.push(request);
      return refuse ? { ok: false, error: refuse } : { ok: true, enqueued: 7 };
    },
  }));
  seed = await seedCatalog(db);
});
afterAll(() => dispose());

describe("encolar", () => {
  test("normalize pide a ingest el backfill de identidades, con quién lo pidió", async () => {
    pipelineRequests.length = 0;
    const res = await post("/v1/admin/pipeline/normalize", { category: "hdd", limit: 100 });
    expect(res.status).toBe(202);
    expect((await res.json()) as object).toEqual({ enqueued: 7 });
    expect(pipelineRequests).toEqual([
      { category: "hdd", limit: 100, stage: "normalize", reason: "backfill", requestedBy: "admin-token" },
    ]);
  });

  test("relink encola el vínculo con la sombra aprobada; sin límite van 500", async () => {
    pipelineRequests.length = 0;
    expect((await post("/v1/admin/pipeline/relink", { category: "hdd" })).status).toBe(202);
    expect(pipelineRequests).toEqual([
      { category: "hdd", limit: 500, stage: "link", reason: "relink", requestedBy: "admin-token" },
    ]);
  });

  test("tienda desconocida → 404; cuerpo inválido → 400; sin credenciales → 401", async () => {
    refuse = "unknown_store";
    const unknown = await post("/v1/admin/pipeline/normalize", { store: "nada" });
    expect(unknown.status).toBe(404);
    expect(ApiErrorSchema.parse(await unknown.json()).error.code).toBe("unknown_store");
    refuse = null;
    expect((await post("/v1/admin/pipeline/normalize", { category: "nope" })).status).toBe(400);
    expect((await post("/v1/admin/pipeline/normalize", {}, { "content-type": "application/json" })).status).toBe(401);
  });
});

describe("sombra", () => {
  const shadow = (
    listing_id: number,
    version: number,
    kind: "link" | "review" | "new_product",
    product_id: number | null,
    current_product_id: number | null,
    agrees: 0 | 1,
  ) =>
    db.query
      .insertInto("match_shadow")
      .values({
        listing_id,
        version,
        kind,
        product_id,
        current_product_id,
        agrees,
        score: 0.9,
        vetoes: JSON.stringify(["vram"]),
        created_at: new Date().toISOString(),
      })
      .execute();

  test("reporte por categoría con la última versión de cada oferta y la muestra de desacuerdos", async () => {
    // l1: la versión 1 dudaba, la 2 coincide: sólo cuenta la 2. l4: movería la oferta del ASUS al MSI.
    await shadow(seed.listings.l1, 1, "review", seed.msi, seed.asus, 0);
    await shadow(seed.listings.l1, 2, "link", seed.asus, seed.asus, 1);
    await shadow(seed.listings.l4, 2, "link", seed.msi, seed.asus, 0);
    // Una oferta de otra categoría no entra en el reporte de gpu.
    const ryzen = await db.query
      .selectFrom("listings")
      .select("id")
      .where("external_id", "=", "3")
      .executeTakeFirstOrThrow();
    await shadow(ryzen.id, 2, "new_product", null, seed.ryzen, 0);

    const res = await get("/v1/admin/pipeline/shadow?category=gpu");
    expect(res.status).toBe(200);
    const report = PipelineShadowReportSchema.parse(await res.json());
    expect(report).toMatchObject({
      category: "gpu",
      version: 2,
      total: 2,
      agrees: 1,
      moves: 1,
      newProducts: 0,
      reviews: 0,
    });
    expect(report.sample).toMatchObject([
      {
        listingId: seed.listings.l4,
        store: "beta",
        kind: "link",
        vetoes: ["vram"],
        current: { id: seed.asus, slug: "asus-dual-rtx-4070-super-oc-12gb" },
        proposed: { id: seed.msi, slug: "msi-rtx-4060-ventus-2x-8gb" },
      },
    ]);

    const cpu = PipelineShadowReportSchema.parse(await (await get("/v1/admin/pipeline/shadow?category=cpu")).json());
    expect(cpu).toMatchObject({ total: 1, newProducts: 1 });
    expect(cpu.sample[0]?.proposed).toBeNull();
  });

  test("sin sombra el reporte está en cero; sin categoría es 400", async () => {
    const ram = PipelineShadowReportSchema.parse(await (await get("/v1/admin/pipeline/shadow?category=ram")).json());
    expect(ram).toMatchObject({ version: null, total: 0, sample: [] });
    expect((await get("/v1/admin/pipeline/shadow")).status).toBe(400);
  });
});
