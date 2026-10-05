import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestD1 } from "../src/testing";

let d1: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
});
afterAll(() => dispose());

// El script usa 'now' con Santiago como UTC−3, igual que acá.
const day = (ago: number) => new Date(Date.now() - 3 * 3600_000 - ago * 86_400_000).toISOString().slice(0, 10);
const noon = (ago: number) => `${day(ago)}T15:00:00.000Z`;

const script = readFileSync(join(import.meta.dir, "..", "scripts", "backfill-price-daily.sql"), "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

test("el backfill reconstruye el mínimo diario y el resumen desde price_points", async () => {
  const now = noon(0);
  const listing = (
    id: number,
    productId: number,
    firstSeen: number,
    lastSeen: number,
    active: number,
    price: number,
    inStock: number,
  ) =>
    d1
      .prepare(
        `INSERT INTO listings (id, store_id, external_id, url, title, category, price_cash, price_card, in_stock,
           is_active, product_id, first_seen_at, last_seen_at, updated_at)
         VALUES (?, 1, ?, 'https://alfa.example', 't', 'gpu', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, String(id), price, price + 1000, inStock, active, productId, noon(firstSeen), noon(lastSeen), now);
  const point = (listingId: number, ago: number, price: number, inStock = 1) =>
    d1
      .prepare(
        "INSERT INTO price_points (listing_id, price_cash, price_card, in_stock, observed_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(listingId, price, price + 1000, inStock, noon(ago));
  await d1.batch([
    d1
      .prepare(
        "INSERT INTO stores (id, slug, name, url, domain, created_at) VALUES (1, 'alfa', 'A', 'https://alfa.example', 'alfa.example', ?)",
      )
      .bind(now),
    d1
      .prepare(
        "INSERT INTO products (id, slug, name, category, created_at, updated_at) VALUES (1, 'p1', 'P1', 'gpu', ?, ?), (2, 'p2', 'P2', 'gpu', ?, ?)",
      )
      .bind(now, now, now, now),
    // Producto 1: una oferta baja de precio, otra se desactiva el día −2.
    listing(1, 1, 3, 0, 1, 90_000, 1),
    point(1, 3, 100_000),
    point(1, 1, 90_000),
    listing(2, 1, 3, 2, 0, 95_000, 1),
    point(2, 3, 95_000),
    // Producto 2: 8 días en la ventana del precio habitual, y hoy sin stock.
    listing(3, 2, 10, 0, 1, 170_000, 0),
    point(3, 10, 200_000),
    point(3, 5, 180_000),
    point(3, 0, 170_000, 0),
  ]);
  // Se corre dos veces: tiene que dar lo mismo.
  for (let i = 0; i < 2; i++) await d1.batch(script.map((s) => d1.prepare(s)));

  const { results: daily } = await d1
    .prepare("SELECT product_id, day, min_cash, offer_count FROM product_price_daily ORDER BY product_id, day")
    .all();
  expect(daily.filter((r) => r.product_id === 1)).toEqual([
    { product_id: 1, day: day(3), min_cash: 95_000, offer_count: 2 },
    { product_id: 1, day: day(2), min_cash: 95_000, offer_count: 2 },
    { product_id: 1, day: day(1), min_cash: 90_000, offer_count: 1 },
    { product_id: 1, day: day(0), min_cash: 90_000, offer_count: 1 },
  ]);
  expect(daily.filter((r) => r.product_id === 2).map((r) => r.day)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(day));

  const { results: products } = await d1
    .prepare("SELECT id, best_price, offer_count, in_stock_offer_count, reference_price FROM products ORDER BY id")
    .all();
  expect(products).toEqual([
    { id: 1, best_price: 90_000, offer_count: 1, in_stock_offer_count: 1, reference_price: null },
    // (5 × 200.000 + 3 × 180.000) / 8
    { id: 2, best_price: null, offer_count: 1, in_stock_offer_count: 0, reference_price: 192_500 },
  ]);
});
