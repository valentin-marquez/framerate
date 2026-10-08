import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ApiErrorSchema, MatchReviewsResponseSchema } from "@framerate/contracts";
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
  const candidate = await product("corsair-vengeance-ddr5", "Corsair Vengeance RGB 32GB DDR5");
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
  test("lista las pendientes con la oferta (tienda, precio) y el candidato, según el contrato", async () => {
    const s = await seedReview();
    const res = await send("/v1/admin/reviews");
    expect(res.status).toBe(200);
    const { items } = MatchReviewsResponseSchema.parse(await res.json());
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: s.review,
      score: 0.72,
      listing: {
        id: s.listing,
        priceCash: 150_000,
        inStock: true,
        gtin: "00840006600008",
        store: { slug: "beta", name: "beta" },
      },
      candidate: { id: s.candidate, brand: "Corsair", category: "ram" },
    });
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

  test("aceptar un par que el matching veta da 409 y no mueve nada", async () => {
    const s = await seedReview();
    await db.query
      .updateTable("products")
      .set({ name: "Corsair Dominator Titanium 32GB" })
      .where("id", "=", s.candidate)
      .execute();
    const res = await send(`/v1/admin/reviews/${s.review}/accept`, "POST");
    expect(res.status).toBe(409);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("review_vetoed");
    expect((await all(db, "listings"))[0]?.product_id).toBe(s.provisional);
    expect((await all(db, "match_reviews"))[0]?.status).toBe("pending");
  });

  test("fusionar dos productos a mano los junta sin revisión de por medio", async () => {
    const s = await seedReview();
    // Sobrevive el que tiene más ofertas, sin importar el orden de los argumentos.
    await db.query.updateTable("products").set({ offer_count: 1 }).where("id", "=", s.provisional).execute();
    const res = await send(`/v1/admin/products/${s.candidate}/merge/${s.provisional}`, "POST");
    expect(res.status).toBe(200);
    expect((await res.json()) as object).toEqual({ from: s.candidate, to: s.provisional });
    expect((await all(db, "products")).map((p) => p.id)).toEqual([s.provisional]);
    expect(await all(db, "product_slug_redirects")).toMatchObject([
      { old_slug: "corsair-vengeance-ddr5", product_id: s.provisional },
    ]);
  });

  test("fusionar a mano con un veto da 409, y con un producto inexistente 404", async () => {
    const s = await seedReview();
    await db.query
      .updateTable("products")
      .set({ name: "Corsair Vengeance RGB 16GB DDR5" })
      .where("id", "=", s.candidate)
      .execute();
    const vetoed = await send(`/v1/admin/products/${s.candidate}/merge/${s.provisional}`, "POST");
    expect(vetoed.status).toBe(409);
    expect(ApiErrorSchema.parse(await vetoed.json()).error.code).toBe("merge_blocked");
    expect(await all(db, "products")).toHaveLength(2);

    const missing = await send(`/v1/admin/products/${s.provisional}/merge/9999`, "POST");
    expect(missing.status).toBe(404);
    expect(ApiErrorSchema.parse(await missing.json()).error.code).toBe("product_not_found");
  });

  test("sin token de admin, fusionar da 401", async () => {
    const s = await seedReview();
    const res = await app.request(`/v1/admin/products/${s.candidate}/merge/${s.provisional}`, { method: "POST" }, env);
    expect(res.status).toBe(401);
    expect(await all(db, "products")).toHaveLength(2);
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
