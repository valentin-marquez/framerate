import { afterAll, beforeAll, expect, test } from "bun:test";
import { createTestD1 } from "../src/testing";

let d1: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
});
afterAll(() => dispose());

const at = "2026-10-20T12:00:00.000Z";

test("desactivar una tienda apaga sus ofertas y recalcula el resumen de sus productos", async () => {
  const listing = (id: number, storeId: number, productId: number, price: number) =>
    d1
      .prepare(
        `INSERT INTO listings (id, store_id, external_id, url, title, category, price_cash, price_card, in_stock,
           is_active, product_id, first_seen_at, last_seen_at, updated_at)
         VALUES (?, ?, ?, 'https://x.example', 't', 'gpu', ?, ?, 1, 1, ?, ?, ?, ?)`,
      )
      .bind(id, storeId, String(id), price, price + 1000, productId, at, at, at);
  const store = (id: number, slug: string) =>
    d1
      .prepare(
        "INSERT INTO stores (id, slug, name, url, domain, created_at) VALUES (?, ?, ?, 'https://x.example', ?, ?)",
      )
      .bind(id, slug, slug, `${slug}.example`, at);
  const product = (id: number, bestPrice: number, offers: number) =>
    d1
      .prepare(
        `INSERT INTO products (id, slug, name, category, best_price, best_price_card, offer_count, in_stock_offer_count,
           created_at, updated_at) VALUES (?, ?, ?, 'gpu', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, `p${id}`, `P${id}`, bestPrice, bestPrice + 1000, offers, offers, at, at);
  await d1.batch([
    store(1, "alfa"),
    store(2, "beta"),
    // Producto 1: sólo en alfa. Producto 2: en alfa (barata) y en beta.
    product(1, 100_000, 1),
    product(2, 90_000, 2),
    listing(1, 1, 1, 100_000),
    listing(2, 1, 2, 90_000),
    listing(3, 2, 2, 120_000),
  ]);
  const version = async () =>
    (await d1.prepare("SELECT version FROM catalog_version WHERE id = 1").first<{ version: number }>())?.version ?? 0;
  const before = await version();

  await d1.prepare("UPDATE stores SET is_active = 0 WHERE id = 1").run();

  const { results: products } = await d1
    .prepare("SELECT id, best_price, offer_count, in_stock_offer_count FROM products ORDER BY id")
    .all();
  expect(products).toEqual([
    { id: 1, best_price: null, offer_count: 0, in_stock_offer_count: 0 },
    { id: 2, best_price: 120_000, offer_count: 1, in_stock_offer_count: 1 },
  ]);
  const { results: listings } = await d1.prepare("SELECT id, is_active FROM listings ORDER BY id").all();
  expect(listings).toEqual([
    { id: 1, is_active: 0 },
    { id: 2, is_active: 0 },
    { id: 3, is_active: 1 },
  ]);
  expect(await version()).toBe(before + 1);

  // Volver a guardar la tienda ya inactiva no recalcula ni sube la versión.
  await d1.prepare("UPDATE stores SET is_active = 0 WHERE id = 1").run();
  expect(await version()).toBe(before + 1);
});
