import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import type { TxtCheck } from "@framerate/kit";
import { FAILURES_TO_FREEZE, recheckClaims } from "@/features/claims/recheck";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const T0 = "2026-06-01T00:00:00.000Z";
const later = (hours: number) => new Date(Date.parse(T0) + hours * 3_600_000).toISOString();
const answer =
  (status: TxtCheck["status"], conclusive = true) =>
  async () =>
    ({ status, conclusive, found: [], resolvers: {} }) as unknown as TxtCheck;

async function seedClaim(status: "confirmed" | "stale" | "pending" = "confirmed", expiresAt = "2027-01-01T00:00:00Z") {
  await db.query
    .insertInto("users")
    .values({ id: "u1", email: "a@x.cl", username: "ana", display_name: "Ana", created_at: T0, updated_at: T0 })
    .execute();
  await db.query
    .insertInto("stores")
    .values({ slug: "alfa", name: "Alfa", url: "https://alfa.cl", domain: "alfa.cl", created_at: T0 })
    .execute();
  await db.query
    .insertInto("store_claims")
    .values({
      store_id: 1,
      claimant_id: "u1",
      domain: "alfa.cl",
      token: "tok",
      status,
      expires_at: expiresAt,
      created_at: T0,
      updated_at: T0,
    })
    .execute();
}
const claim = async () => (await all(db, "store_claims"))[0];
const frozen = async () => (await all(db, "stores"))[0]?.frozen_at ?? null;

describe("recheckClaims", () => {
  test("el registro sigue: sin cambios ni ruido en la auditoría", async () => {
    await seedClaim();
    const stats = await recheckClaims(db, later(6), answer("verified"));
    expect(stats).toMatchObject({ checked: 1, frozen: 0 });
    expect(await claim()).toMatchObject({ status: "confirmed", consecutive_failures: 0 });
    expect(await all(db, "store_claim_events")).toHaveLength(0);
  });

  test("tras varias fallas conclusivas seguidas se marca stale y se congela la tienda", async () => {
    await seedClaim();
    for (let i = 1; i < FAILURES_TO_FREEZE; i++) {
      await recheckClaims(db, later(6 * i), answer("pending"));
      expect(await claim()).toMatchObject({ status: "confirmed", consecutive_failures: i });
      expect(await frozen()).toBeNull();
    }
    const stats = await recheckClaims(db, later(6 * FAILURES_TO_FREEZE), answer("pending"));
    expect(stats.frozen).toBe(1);
    expect(await claim()).toMatchObject({ status: "stale", consecutive_failures: FAILURES_TO_FREEZE });
    expect(await frozen()).not.toBeNull();
    expect(
      (await all(db, "store_claim_events"))
        .map((e) => e.action)
        .slice(-1)
        .join(),
    ).toBe("stale");
  });

  test("una caída de los resolvers no cuenta como falla", async () => {
    await seedClaim();
    await recheckClaims(db, later(6), answer("error", false));
    expect(await claim()).toMatchObject({ status: "confirmed", consecutive_failures: 0 });
  });

  test("si el registro reaparece, la tienda se descongela", async () => {
    await seedClaim("stale");
    await db.query.updateTable("stores").set({ frozen_at: T0 }).execute();
    const stats = await recheckClaims(db, later(6), answer("verified"));
    expect(stats.recovered).toBe(1);
    expect(await claim()).toMatchObject({ status: "confirmed", consecutive_failures: 0 });
    expect(await frozen()).toBeNull();
  });

  test("no repite un chequeo hecho hace poco", async () => {
    await seedClaim();
    await recheckClaims(db, later(6), answer("verified"));
    expect((await recheckClaims(db, later(7), answer("verified"))).checked).toBe(0);
  });

  test("vence los reclamos que nadie completó", async () => {
    await seedClaim("pending", later(1));
    const stats = await recheckClaims(db, later(6), answer("verified"));
    expect(stats.expired).toBe(1);
    expect(await claim()).toMatchObject({ status: "expired" });
  });
});
