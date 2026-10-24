import { CompiledQuery, sql } from "kysely";
import { bumpCatalogVersionQuery, throttledBumpCatalogVersionQuery } from "./catalog-version";
import type { Db } from "./client";

/**
 * Resumen de precios de `products` y fila del día en `product_price_daily`, recalculados desde `listings` de todas
 * las tiendas. Se recalcula desde cero (no se suma) para que reintentos de la cola y corridas paralelas den lo mismo.
 * `scripts/backfill-price-daily.sql` repite estas sentencias para todos los productos, y el trigger
 * `stores_deactivated_au` (migración 0037) el resumen al desactivar una tienda: mantenerlos iguales.
 */

/**
 * `scope` es una subconsulta que devuelve ids de producto. Sólo ofertas activas y publicadas (una oculta por el pipeline,
 * #153, no puede mover el precio de un producto) y sin revisión de matching pendiente (su producto puede ser un duplicado:
 * sale de las listas hasta que el Gatekeeper decida); el precio sólo de las con stock. Quien abre o cierra una revisión
 * tiene que recalcular. Los conteos son de tiendas: una
 * tienda que publica el mismo producto dos veces cuenta una.
 */
const summarySql = (scope: string) => `
UPDATE products SET
  (best_price, best_price_card, offer_count, in_stock_offer_count) = (
    SELECT MIN(CASE WHEN in_stock = 1 THEN price_cash END), MIN(CASE WHEN in_stock = 1 THEN price_card END),
      COUNT(DISTINCT store_id), COUNT(DISTINCT CASE WHEN in_stock = 1 THEN store_id END)
    FROM listings WHERE product_id = products.id AND is_active = 1 AND visible = 1
      AND id NOT IN (SELECT listing_id FROM match_reviews WHERE status = 'pending')),
  prices_updated_at = ?4
WHERE id IN (${scope})`;

/** El mínimo del día es el menor visto en cualquier corrida del día, no sólo el de la última. */
const dailySql = (scope: string) => `
INSERT INTO product_price_daily (product_id, day, min_cash, min_card, offer_count)
SELECT id, ?5, best_price, best_price_card, in_stock_offer_count
FROM products WHERE id IN (${scope}) AND best_price IS NOT NULL
ON CONFLICT (product_id, day) DO UPDATE SET
  min_cash = MIN(min_cash, excluded.min_cash),
  min_card = MIN(min_card, excluded.min_card),
  offer_count = excluded.offer_count`;

/**
 * Precio habitual: promedio del mínimo diario entre hoy−32 y hoy−3 (excluye los últimos días para que una baja
 * reciente no se compare consigo misma), con al menos 3 días de datos. El máximo premiaba inflar antes de un evento.
 */
const referenceSql = (scope: string) => `
UPDATE products SET reference_price = (
  SELECT CASE WHEN COUNT(*) >= 3 THEN CAST(ROUND(AVG(min_cash)) AS INTEGER) END
  FROM product_price_daily
  WHERE product_id = products.id AND day BETWEEN date(?5, '-32 days') AND date(?5, '-3 days'))
WHERE id IN (${scope})`;

/** Productos tocados por una corrida: los de sus ofertas (también desactivadas) y los que perdieron una oferta. */
const CRAWL_SCOPE = `SELECT product_id FROM listings WHERE store_id = ?1 AND category = ?2 AND product_id IS NOT NULL
  UNION SELECT value FROM json_each(?3)`;

/** Día calendario en Chile (con su horario de verano). */
export const santiagoDay = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });

/** Productos que una oferta dejó o ganó fuera de una corrida (Gatekeeper, separar, fusionar). */
const PRODUCTS_SCOPE = "SELECT value FROM json_each(?3)";

export function refreshPriceSummary(
  db: Db,
  input: { storeId: number; category: string; previousProductIds: Iterable<number>; now: Date },
) {
  return refresh(db, CRAWL_SCOPE, input.storeId, input.category, input.previousProductIds, input.now);
}

/** `throttleVersion`: el refresco horario sube la versión del catálogo como mucho cada 15 min (#121). */
export function refreshProductsPriceSummary(
  db: Db,
  productIds: Iterable<number>,
  now: Date,
  options: { throttleVersion?: boolean } = {},
) {
  const bump = options.throttleVersion ? throttledBumpCatalogVersionQuery : bumpCatalogVersionQuery;
  return refresh(db, PRODUCTS_SCOPE, null, null, productIds, now, bump);
}

async function refresh(
  db: Db,
  scope: string,
  storeId: number | null,
  category: string | null,
  productIds: Iterable<number>,
  now: Date,
  bump = bumpCatalogVersionQuery,
) {
  const params = [storeId, category, JSON.stringify([...productIds]), now.toISOString(), santiagoDay(now)];
  // Las tres en un batch (una transacción): el reference_price lee la fila del día recién escrita. La versión del
  // catálogo sube en la misma transacción, así la caché del server no ve precios nuevos con la versión vieja.
  // D1 rechaza más valores que el mayor ?N de la sentencia: el resumen no usa el día (?5).
  await db.batch([
    ...[[summarySql, params.slice(0, 4)] as const, [dailySql, params] as const, [referenceSql, params] as const].map(
      ([build, values]) => ({ compile: () => CompiledQuery.raw(build(scope), values) }),
    ),
    { compile: () => bump },
  ]);
}

/**
 * Red de seguridad del Cron (#219): productos cuyo resumen dice que hay stock sin ninguna oferta viva con stock, o al
 * revés (un UPDATE a mano en Studio, un camino de código que olvidó recalcular). Recalcula hasta `limit` por corrida y
 * devuelve cuántos corrigió: si no es cero seguido, hay otra causa por encontrar.
 */
export async function reconcilePriceSummary(db: Db, now: Date, limit = 500): Promise<number> {
  const { rows } = await sql<{ id: number }>`
    SELECT p.id FROM products p
    WHERE (p.in_stock_offer_count > 0) <> EXISTS (
      SELECT 1 FROM listings l WHERE l.product_id = p.id AND l.is_active = 1 AND l.visible = 1 AND l.in_stock = 1
        AND l.id NOT IN (SELECT listing_id FROM match_reviews WHERE status = 'pending'))
    LIMIT ${limit}`.execute(db.query);
  if (rows.length === 0) return 0;
  await refreshProductsPriceSummary(
    db,
    rows.map((r) => r.id),
    now,
  );
  return rows.length;
}
