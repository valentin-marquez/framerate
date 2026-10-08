import { afterAll, beforeAll, expect, test } from "bun:test";
import { ProductDetailSchema, ProductPageSchema } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { createTestD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { seedCatalog, testEnv } from "./helpers";

let db: Db;
let dispose: () => Promise<void>;
let env: Env;
let seed: Awaited<ReturnType<typeof seedCatalog>>;
const app = createApp();
const page = async (query: string) =>
  ProductPageSchema.parse(await (await app.request(`/v1/products?${query}`, undefined, env)).json());

beforeAll(async () => {
  let d1: D1Database;
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
  seed = await seedCatalog(db);
});
afterAll(() => dispose());

const review = async (listingStoreExternalId: string, candidate: number) => {
  const { id } = await db.query
    .selectFrom("listings")
    .select("id")
    .where("external_id", "=", listingStoreExternalId)
    .executeTakeFirstOrThrow();
  const { id: reviewId } = await db.query
    .insertInto("match_reviews")
    .values({ listing_id: id, candidate_product_id: candidate, score: 0.6, created_at: new Date().toISOString() })
    .returning("id")
    .executeTakeFirstOrThrow();
  return reviewId;
};

test("una oferta con revisión pendiente sale de las listas hasta que se resuelve, y su ficha sigue", async () => {
  // El Ryzen sólo tiene la oferta "3": el matching dudó y su producto podría ser un duplicado del candidato.
  const pending = await review("3", seed.asus);
  expect((await page("category=cpu")).total).toBe(0);
  const res = await app.request("/v1/products/amd-ryzen-7-7800x3d", undefined, env);
  expect(ProductDetailSchema.parse(await res.json()).offers).toHaveLength(1);

  await db.query.updateTable("match_reviews").set({ status: "rejected" }).where("id", "=", pending).execute();
  expect((await page("category=cpu")).total).toBe(1);
});

test("un producto con otras ofertas sigue en las listas: sólo deja de contar la oferta en duda", async () => {
  await review("9", seed.msi);
  expect((await page("category=gpu")).items.map((p) => [p.name, p.bestPrice, p.offerCount])).toEqual([
    ["ASUS Dual RTX 4070 SUPER OC 12GB", 650_000, 1],
  ]);
});
