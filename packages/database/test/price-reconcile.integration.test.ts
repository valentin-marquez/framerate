import { afterAll, beforeAll, expect, test } from "bun:test";
import { createDb } from "../src/client";
import { reconcilePriceSummary } from "../src/price-summary";
import { createTestD1 } from "../src/testing";

let d1: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
});
afterAll(() => dispose());

const at = "2026-10-22T12:00:00.000Z";

test("la reconciliación repara un resumen desfasado en los dos sentidos y después no toca nada", async () => {
  const product = (id: number, bestPrice: number | null, inStock: number) =>
    d1
      .prepare(
        `INSERT INTO products (id, slug, name, category, best_price, offer_count, in_stock_offer_count, created_at, updated_at)
         VALUES (?, ?, ?, 'gpu', ?, ?, ?, ?, ?)`,
      )
      .bind(id, `p${id}`, `P${id}`, bestPrice, inStock, inStock, at, at);
  const listing = (id: number, productId: number, price: number) =>
    d1
      .prepare(
        `INSERT INTO listings (id, store_id, external_id, url, title, category, price_cash, price_card, in_stock, is_active,
           product_id, first_seen_at, last_seen_at, updated_at)
         VALUES (?, 1, ?, 'https://x.example', 't', 'gpu', ?, ?, 1, 1, ?, ?, ?, ?)`,
      )
      .bind(id, String(id), price, price + 1000, productId, at, at, at);
  await d1.batch([
    d1
      .prepare(
        "INSERT INTO stores (id, slug, name, url, domain, created_at) VALUES (1, 'alfa', 'alfa', 'https://x.example', 'alfa.example', ?)",
      )
      .bind(at),
    // 1: el resumen dice stock y no hay ofertas (tienda vetada a mano). 2: el resumen dice 0 y hay una oferta viva.
    // 3: está bien y no se toca.
    product(1, 100_000, 1),
    product(2, null, 0),
    product(3, 50_000, 1),
    listing(2, 2, 80_000),
    listing(3, 3, 50_000),
  ]);
  const db = createDb(d1);
  const updatedAt = async (id: number) =>
    (
      await d1
        .prepare("SELECT prices_updated_at FROM products WHERE id = ?")
        .bind(id)
        .first<{ prices_updated_at: string }>()
    )?.prices_updated_at;
  const untouchedBefore = await updatedAt(3);

  expect(await reconcilePriceSummary(db, new Date(at))).toBe(2);

  const { results } = await d1.prepare("SELECT id, best_price, in_stock_offer_count FROM products ORDER BY id").all();
  expect(results).toEqual([
    { id: 1, best_price: null, in_stock_offer_count: 0 },
    { id: 2, best_price: 80_000, in_stock_offer_count: 1 },
    { id: 3, best_price: 50_000, in_stock_offer_count: 1 },
  ]);
  expect(await updatedAt(3)).toBe(untouchedBefore);
  expect(await reconcilePriceSummary(db, new Date(at))).toBe(0);
});
