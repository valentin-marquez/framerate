import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { daysAgo, testEnv } from "./helpers";

/**
 * Revisión humana de matches dudosos: la oferta tiene un producto provisional
 * (con su identificador) y se propone fusionarla con un candidato.
 */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
const admin = { headers: { authorization: "Bearer test-admin-token" } };
const send = (path: string, method = "GET") => app.request(path, { method, ...admin }, env);

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

async function seedReview() {
  const at = daysAgo(1);
  const store = await db.query
    .insertInto("stores")
    .values({ slug: "beta", name: "beta", url: "https://beta.cl", domain: "beta.cl", created_at: at })
    .returning("id")
    .executeTakeFirstOrThrow();
  const product = (slug: string, name: string) =>
    db.query
      .insertInto("products")
      .values({ slug, name, category: "ram", brand: "Corsair", created_at: at, updated_at: at })
      .returning("id")
      .executeTakeFirstOrThrow();
  const candidate = await product("corsair-dominator", "Corsair Dominator Titanium 32GB");
  const provisional = await product("corsair-vengeance", "Corsair Vengeance RGB 32GB");
  await db.query
    .insertInto("product_identifiers")
    .values({ kind: "gtin", value: "00840006600008", product_id: provisional.id })
    .execute();
  const listing = await db.query
    .insertInto("listings")
    .values({
      store_id: store.id,
      product_id: provisional.id,
      external_id: "2",
      url: "https://beta.cl/p/2",
      title: "Corsair Vengeance RGB 32GB",
      category: "ram",
      gtin: "00840006600008",
      price_cash: 150_000,
      price_card: 150_000,
      in_stock: 1,
      first_seen_at: at,
      last_seen_at: at,
      updated_at: at,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const review = await db.query
    .insertInto("match_reviews")
    .values({
      listing_id: listing.id,
      candidate_product_id: candidate.id,
      score: 0.72,
      evidence: JSON.stringify({ titleSimilarity: 0.4 }),
      created_at: at,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { candidate: candidate.id, provisional: provisional.id, listing: listing.id, review: review.id };
}

describe("revisión de matches", () => {
  test("lista las pendientes con el candidato y la oferta", async () => {
    const s = await seedReview();
    const res = await send("/v1/admin/reviews");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: number; score: number; candidate: { id: number } }[] };
    expect(body.items).toMatchObject([{ id: s.review, score: 0.72, candidate: { id: s.candidate } }]);
  });

  test("aceptar mueve la oferta al candidato y le traslada sus identificadores", async () => {
    const s = await seedReview();
    expect((await send(`/v1/admin/reviews/${s.review}/accept`, "POST")).status).toBe(204);

    const listing = (await all(db, "listings")).find((l) => l.id === s.listing);
    expect(listing?.product_id).toBe(s.candidate);
    expect(await all(db, "product_identifiers")).toEqual([
      { kind: "gtin", value: "00840006600008", product_id: s.candidate },
    ]);
    const [decision] = await all(db, "match_decisions");
    expect(decision).toMatchObject({ method: "manual", product_id: s.candidate, listing_id: s.listing });
    expect((await all(db, "match_reviews"))[0]?.status).toBe("accepted");
    expect((await (await send("/v1/admin/reviews")).json()) as object).toEqual({ items: [] });
  });

  test("rechazar deja la oferta en su producto propio", async () => {
    const s = await seedReview();
    expect((await send(`/v1/admin/reviews/${s.review}/reject`, "POST")).status).toBe(204);
    const listing = (await all(db, "listings")).find((l) => l.id === s.listing);
    expect(listing?.product_id).toBe(s.provisional);
    expect((await all(db, "match_reviews"))[0]?.status).toBe("rejected");
  });

  test("resolver dos veces o una inexistente da error claro", async () => {
    const s = await seedReview();
    await send(`/v1/admin/reviews/${s.review}/reject`, "POST");
    const again = await send(`/v1/admin/reviews/${s.review}/accept`, "POST");
    expect(again.status).toBe(409);
    expect(ApiErrorSchema.parse(await again.json()).error.code).toBe("review_already_resolved");

    const missing = await send("/v1/admin/reviews/9999/accept", "POST");
    expect(missing.status).toBe(404);
    expect(ApiErrorSchema.parse(await missing.json()).error.code).toBe("review_not_found");
  });
});
