import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import Anthropic from "@anthropic-ai/sdk";
import { type LinkMessage, NORMALIZER_VERSION } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { silentLogger } from "@framerate/kit";
import { NORMALIZE_MODEL } from "@framerate/matching/normalize";
import { billingCycle, dailyCapUsd } from "@/budget";
import { type NormalizeConfig, normalizeListing } from "@/normalize";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
const now = new Date("2026-10-08T12:00:00.000Z");
const at = "2026-10-07T12:00:00.000Z";

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const TITLE = "Memoria RAM Kingston Fury Beast 16GB DDR5 5600MHz CL36 KF556C36BBE-16";
const OUTPUT = {
  category: "ram",
  category_reason: "",
  brand: "Kingston",
  name: "Kingston Fury Beast 16GB DDR5 5600 CL36",
  mpn: "KF556C36BBE-16",
  condition: "new",
  confidence: "high",
  identity: {
    type: "ddr5",
    capacity_gb: "16",
    modules: "1",
    speed_mt_s: "5600",
    form_factor: "dimm",
    line: "Fury Beast",
    rgb: "false",
    color: "black",
    ecc: "false",
    registered: "false",
    cas_latency: "36",
  },
  identity_from_mpn: ["cas_latency"],
  identity_from_knowledge: ["color"],
  specs: { timings: "36-38-38", voltage: "1.25", heat_spreader: "true", xmp_expo: "" },
  specs_from_knowledge: ["voltage"],
};

type Reply = { text?: string; stop?: string } | Error;
const usage = { input_tokens: 700, output_tokens: 300, cache_read_input_tokens: 3400, cache_creation_input_tokens: 0 };

/** Haiku falso: responde en orden lo que se le pida y cuenta las llamadas. */
function fakeHaiku(...replies: Reply[]) {
  const haiku = {
    calls: 0,
    create: async () => {
      const r = replies[Math.min(haiku.calls++, replies.length - 1)];
      if (r instanceof Error) throw r;
      return {
        content: r?.text === undefined ? [] : [{ type: "text", text: r.text }],
        stop_reason: r?.stop ?? "end_turn",
        usage,
      } as unknown as Anthropic.Message;
    },
  };
  return haiku;
}
const ok = (overrides: Partial<typeof OUTPUT> = {}): Reply => ({ text: JSON.stringify({ ...OUTPUT, ...overrides }) });
const apiError = (status: number, message: string) =>
  Anthropic.APIError.generate(status, { type: "error", error: { type: "api_error", message } }, message, new Headers());

const config = (h: ReturnType<typeof fakeHaiku>, extra: Partial<NormalizeConfig> = {}): NormalizeConfig => ({
  mode: "shadow",
  create: h.create,
  monthlyUsd: 20,
  cycleDay: 17,
  ...extra,
});

function fakeQueue() {
  const sent: LinkMessage[] = [];
  const queue = { sent, send: async (m: LinkMessage) => void sent.push(m) };
  return queue as typeof queue & Queue<LinkMessage>;
}

async function storeId() {
  const existing = await db.query.selectFrom("stores").select("id").where("slug", "=", "beta").executeTakeFirst();
  if (existing) return existing.id;
  const store = await db.query
    .insertInto("stores")
    .values({ slug: "beta", name: "Beta", url: "https://beta.cl", domain: "beta.cl", created_at: at })
    .returning("id")
    .executeTakeFirstOrThrow();
  return store.id;
}

async function seedListing(overrides: Record<string, unknown> = {}) {
  const listing = await db.query
    .insertInto("listings")
    .values({
      store_id: await storeId(),
      external_id: "1",
      url: "https://beta.cl/p/1",
      title: TITLE,
      raw_title: TITLE,
      category: "ram",
      brand: "Kingston",
      mpn: "KF556C36BBE-16",
      price_cash: 50_000,
      price_card: 50_000,
      in_stock: 1,
      first_seen_at: at,
      last_seen_at: at,
      updated_at: at,
      norm_hash: "hash-1",
      norm_status: "pending",
      source_text: "Kingston FURY Beast DDR5 16GB 5600MT/s CL36 DIMM. Non-ECC, unbuffered.",
      ...overrides,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return listing.id;
}

const message = (listingId: number, reason: "new" | "changed" | "backfill" = "new") => ({
  listingId,
  version: NORMALIZER_VERSION,
  reason,
});
const run = (listingId: number, cfg: NormalizeConfig, link = fakeQueue(), attempts = 1) =>
  normalizeListing(db, link, message(listingId), cfg, { now, attempts, log: silentLogger });
const listingRow = (id: number) =>
  db.query.selectFrom("listings").select(["norm_status", "norm_at"]).where("id", "=", id).executeTakeFirstOrThrow();

describe("normalizeListing", () => {
  test("normaliza: identidad anclada, libro de gasto, estado y vínculo encolado", async () => {
    const id = await seedListing();
    const h = fakeHaiku(ok());
    const link = fakeQueue();
    expect(await run(id, config(h), link)).toEqual({ status: "normalized" });
    expect(h.calls).toBe(1);

    const [identity] = await all(db, "listing_identity");
    expect(identity).toMatchObject({
      listing_id: id,
      version: NORMALIZER_VERSION,
      input_hash: "hash-1",
      model: NORMALIZE_MODEL,
      category: "ram",
      brand: "Kingston",
      name: OUTPUT.name,
      mpn: "KF556C36BBE16",
      confidence: "high",
      created_at: now.toISOString(),
    });
    const anchored = JSON.parse(identity?.identity ?? "{}");
    expect(anchored).toMatchObject({ type: "ddr5", capacity_gb: 16, speed_mt_s: 5600, cas_latency: 36 });
    // "rgb=false" sin token negativo y el color por defecto no anclan: quedan fuera de la identidad, pero en la cruda.
    expect(anchored.rgb).toBeUndefined();
    expect(anchored.color).toBeUndefined();
    const raw = JSON.parse(identity?.identity_raw ?? "{}");
    expect(raw.identity.rgb).toBe(false);
    expect(raw.dropped).toContain("rgb");
    expect(raw.identity_from_knowledge).toEqual(["color"]);
    expect(JSON.parse(identity?.specs ?? "{}")).toEqual({ timings: "36-38-38", voltage: 1.25, heat_spreader: true });
    expect(JSON.parse(identity?.specs_source ?? "{}")).toEqual({
      timings: "text",
      voltage: "knowledge",
      heat_spreader: "text",
    });

    const [spent] = await all(db, "ai_usage");
    expect(spent).toMatchObject({
      worker: "normalize",
      purpose: "normalize",
      model: NORMALIZE_MODEL,
      listing_id: id,
      input_tokens: 700,
      output_tokens: 300,
      cache_read_tokens: 3400,
      status: "ok",
      error: null,
    });
    // 700 × $0,1/M + 300 × $0,5/M + 3400 × $0,01/M.
    expect(spent?.usd).toBeCloseTo(0.000254, 8);

    expect(await listingRow(id)).toEqual({ norm_status: "normalized", norm_at: now.toISOString() });
    expect(link.sent).toEqual([{ listingId: id, version: NORMALIZER_VERSION, reason: "new" }]);
  });

  test("misma entrada y misma versión: no vuelve a pagar, y vuelve a pedir el vínculo si no corrió", async () => {
    const id = await seedListing();
    await run(id, config(fakeHaiku(ok())));
    const h = fakeHaiku(ok());
    const link = fakeQueue();
    expect(await run(id, config(h), link)).toEqual({ status: "skipped" });
    expect(h.calls).toBe(0);
    expect(link.sent).toHaveLength(1);

    // Ya vinculada: tampoco se vuelve a encolar.
    await db.query.updateTable("listings").set({ norm_status: "linked" }).where("id", "=", id).execute();
    const again = fakeQueue();
    await run(id, config(h), again);
    expect(again.sent).toHaveLength(0);

    // Cambia el hash (título o ficha nuevos): se paga de nuevo y la fila se reemplaza.
    await db.query.updateTable("listings").set({ norm_hash: "hash-2" }).where("id", "=", id).execute();
    expect(await run(id, config(h))).toEqual({ status: "normalized" });
    expect(h.calls).toBe(1);
    const rows = await all(db, "listing_identity");
    expect(rows.map((r) => r.input_hash)).toEqual(["hash-2"]);
  });

  test("oferta inactiva, sin hash o inexistente: se salta sin pagar (el backfill sí cubre inactivas)", async () => {
    const h = fakeHaiku(ok());
    const inactive = await seedListing({ is_active: 0 });
    expect(await run(inactive, config(h))).toEqual({ status: "skipped" });
    const link = fakeQueue();
    const backfill = { listingId: inactive, version: NORMALIZER_VERSION, reason: "backfill" as const };
    const out = await normalizeListing(db, link, backfill, config(h), { now, attempts: 1, log: silentLogger });
    expect(out).toEqual({ status: "normalized" });
    expect(h.calls).toBe(1);

    await resetD1(d1);
    const noHash = await seedListing({ norm_hash: null });
    expect(await run(noHash, config(h))).toEqual({ status: "skipped" });
    expect(await run(999, config(h))).toEqual({ status: "skipped" });
    expect(h.calls).toBe(1);
  });

  test("429: espera 60, 300 y 900 s según el intento, con la llamada anotada en el libro", async () => {
    const id = await seedListing();
    const h = fakeHaiku(apiError(429, "rate limited"));
    expect(await run(id, config(h), fakeQueue(), 1)).toEqual({
      status: "wait",
      reason: "rate_limited",
      delaySeconds: 60,
    });
    expect(await run(id, config(h), fakeQueue(), 2)).toMatchObject({ delaySeconds: 300 });
    expect(await run(id, config(h), fakeQueue(), 5)).toMatchObject({ delaySeconds: 900 });
    const rows = await all(db, "ai_usage");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ status: "rate_limited", usd: 0, input_tokens: 0, ms: null });
    expect(rows[0]?.error).toMatch(/rate limited/);
    expect((await listingRow(id)).norm_status).toBe("pending");
    expect(await all(db, "listing_identity")).toHaveLength(0);
  });

  test("sin crédito: pausa global y los mensajes siguientes esperan sin llamar", async () => {
    const a = await seedListing();
    const h = fakeHaiku(apiError(400, "Your credit balance is too low to access the Anthropic API."));
    expect(await run(a, config(h))).toEqual({ status: "wait", reason: "no_credit", delaySeconds: 3600 });
    const [state] = await all(db, "pipeline_state");
    expect(state?.paused_until).toBe("2026-10-08T13:00:00.000Z");
    expect((await all(db, "ai_usage"))[0]?.status).toBe("no_credit");

    const b = await seedListing({ external_id: "2" });
    const later = fakeHaiku(ok());
    const paused = await normalizeListing(db, fakeQueue(), message(b), config(later), {
      now: new Date("2026-10-08T12:30:00.000Z"),
      attempts: 2,
      log: silentLogger,
    });
    expect(paused).toEqual({ status: "wait", reason: "paused", delaySeconds: 1800 });
    expect(later.calls).toBe(0);

    // Pasada la pausa vuelve a intentar.
    const resumed = await normalizeListing(db, fakeQueue(), message(b), config(later), {
      now: new Date("2026-10-08T13:00:01.000Z"),
      attempts: 3,
      log: silentLogger,
    });
    expect(resumed).toEqual({ status: "normalized" });
  });

  test("otro error de la API: reintento normal sin pausa", async () => {
    const id = await seedListing();
    const h = fakeHaiku(apiError(529, "overloaded"));
    expect(await run(id, config(h), fakeQueue(), 2)).toEqual({ status: "wait", reason: "error", delaySeconds: 120 });
    expect((await all(db, "pipeline_state")).some((s) => s.paused_until)).toBe(false);
    expect((await all(db, "ai_usage"))[0]?.status).toBe("error");
  });

  test("refusal: la oferta queda failed con el motivo en el libro", async () => {
    const id = await seedListing();
    const link = fakeQueue();
    expect(await run(id, config(fakeHaiku({ stop: "refusal" })), link)).toEqual({ status: "failed" });
    expect((await all(db, "ai_usage"))[0]).toMatchObject({ status: "refusal", error: "refusal", usd: 0.000254 });
    expect(await listingRow(id)).toEqual({ norm_status: "failed", norm_at: now.toISOString() });
    expect(link.sent).toHaveLength(0);
    expect(await all(db, "listing_identity")).toHaveLength(0);
  });

  test("JSON inválido dos veces: failed, con una fila por llamada", async () => {
    const id = await seedListing();
    const h = fakeHaiku({ text: "{not json" });
    expect(await run(id, config(h))).toEqual({ status: "failed" });
    expect(h.calls).toBe(2);
    const rows = await all(db, "ai_usage");
    expect(rows.map((r) => r.status)).toEqual(["ok", "invalid"]);
    expect(rows[1]?.error).toMatch(/JSON/);
    expect((await listingRow(id)).norm_status).toBe("failed");
  });

  test("category other: sin identidad, queda failed", async () => {
    const id = await seedListing();
    const out = await run(id, config(fakeHaiku(ok({ category: "other", category_reason: "es un kit con cooler" }))));
    expect(out).toEqual({ status: "failed" });
    expect((await listingRow(id)).norm_status).toBe("failed");
  });

  test("tope del día agotado: no llama y espera una hora", async () => {
    const id = await seedListing();
    const h = fakeHaiku(ok());
    expect(await run(id, config(h, { monthlyUsd: 0 }))).toEqual({
      status: "wait",
      reason: "budget",
      delaySeconds: 3600,
    });
    expect(h.calls).toBe(0);
    expect((await listingRow(id)).norm_status).toBe("pending");

    // Lo gastado hoy según `ai_usage` descuenta del tope: con $20 al mes y 9 días al 17 caben ~$2,2 al día.
    await db.query
      .insertInto("ai_usage")
      .values({
        at: "2026-10-08T01:00:00.000Z",
        worker: "normalize",
        purpose: "normalize",
        model: NORMALIZE_MODEL,
        listing_id: null,
        review_id: null,
        usd: 2.3,
        status: "ok",
        error: null,
      })
      .execute();
    expect(await run(id, config(h))).toMatchObject({ status: "wait", reason: "budget" });
    expect(h.calls).toBe(0);
  });

  test("sin clave de Anthropic los mensajes esperan", async () => {
    const id = await seedListing();
    expect(await run(id, config(fakeHaiku(ok()), { create: null }))).toMatchObject({ reason: "no_api_key" });
  });

  test("off: acusa sin llamar ni tocar nada", async () => {
    const id = await seedListing();
    const h = fakeHaiku(ok());
    expect(await run(id, config(h, { mode: "off" }))).toEqual({ status: "off" });
    expect(h.calls).toBe(0);
    expect((await listingRow(id)).norm_status).toBe("pending");
    expect(await all(db, "ai_usage")).toHaveLength(0);
  });
});

describe("tope ligado al ciclo de facturación", () => {
  test("el ciclo va del día 17 al 17 del mes siguiente, también al cruzar el año", () => {
    expect(billingCycle(new Date("2026-10-08T12:00:00Z"), 17)).toEqual({
      start: new Date("2026-09-17T00:00:00Z"),
      end: new Date("2026-10-17T00:00:00Z"),
    });
    expect(billingCycle(new Date("2027-01-05T00:00:00Z"), 17).start).toEqual(new Date("2026-12-17T00:00:00Z"));
  });

  test("reparte lo que queda entre los días que faltan, hoy incluido", () => {
    expect(dailyCapUsd(new Date("2026-10-08T15:00:00Z"), 17, 20, 2)).toBeCloseTo(2, 6);
    expect(dailyCapUsd(new Date("2026-10-16T23:00:00Z"), 17, 20, 15)).toBeCloseTo(5, 6);
    expect(dailyCapUsd(new Date("2026-10-08T15:00:00Z"), 17, 20, 40)).toBe(0);
  });
});
