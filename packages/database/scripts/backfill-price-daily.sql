-- Reconstruye product_price_daily desde price_points y recalcula el resumen de precios de TODOS los productos.
-- Idempotente: se puede correr de nuevo sin duplicar ni empeorar nada. Equivale a src/price-summary.ts con
-- alcance "todos los productos" y hoy = date('now', '-3 hours').
--
-- Aproximaciones: Santiago como UTC−3 fijo (en invierno es UTC−4: un cambio entre 23:00 y 24:00 puede caer en el
-- día siguiente); el estado de cada oferta es el del cierre del día (no el mínimo dentro del día), y se usa su
-- producto actual (un cambio de vínculo antiguo no se reconstruye).
-- ponytail: cruza días × ofertas × puntos de precio; con meses de historia convendría acotar por rango de días.

WITH RECURSIVE days(day) AS (
  SELECT date(MIN(observed_at), '-3 hours') FROM price_points
  UNION ALL
  SELECT date(day, '+1 day') FROM days WHERE day < date('now', '-3 hours')
),
bounds AS (
  SELECT day,
    strftime('%Y-%m-%dT%H:%M:%fZ', day, '+3 hours') AS starts,
    strftime('%Y-%m-%dT%H:%M:%fZ', day, '+27 hours') AS ends
  FROM days
),
state AS (
  SELECT b.day, l.product_id, pp.price_cash, pp.price_card, pp.in_stock,
    ROW_NUMBER() OVER (PARTITION BY b.day, l.id ORDER BY pp.observed_at DESC, pp.id DESC) AS rn
  FROM bounds b
  JOIN listings l ON l.product_id IS NOT NULL AND l.first_seen_at < b.ends
    AND (l.is_active = 1 OR l.last_seen_at >= b.starts)
  JOIN price_points pp ON pp.listing_id = l.id AND pp.observed_at < b.ends
)
INSERT INTO product_price_daily (product_id, day, min_cash, min_card, offer_count)
SELECT product_id, day, MIN(price_cash), MIN(price_card), COUNT(*)
FROM state WHERE rn = 1 AND in_stock = 1
GROUP BY product_id, day
ON CONFLICT (product_id, day) DO UPDATE SET
  min_cash = MIN(min_cash, excluded.min_cash),
  min_card = MIN(min_card, excluded.min_card),
  offer_count = excluded.offer_count;

UPDATE products SET
  (best_price, best_price_card, offer_count, in_stock_offer_count) = (
    SELECT MIN(CASE WHEN in_stock = 1 THEN price_cash END), MIN(CASE WHEN in_stock = 1 THEN price_card END),
      COUNT(*), COALESCE(SUM(in_stock), 0)
    FROM listings WHERE product_id = products.id AND is_active = 1),
  prices_updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

UPDATE products SET reference_price = (
  SELECT CASE WHEN COUNT(*) >= 3 THEN CAST(ROUND(AVG(min_cash)) AS INTEGER) END
  FROM product_price_daily
  WHERE product_id = products.id
    AND day BETWEEN date('now', '-3 hours', '-32 days') AND date('now', '-3 hours', '-3 days'));
