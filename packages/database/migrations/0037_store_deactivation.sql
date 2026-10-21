-- Vetar o desactivar una tienda (#219): sus ofertas se apagan y el resumen de precios de sus productos se recalcula en
-- el mismo momento. Ningún crawl lo haría después: una tienda inactiva ya no se rastrea, y las listas (que leen el
-- resumen de `products`) seguían mostrando productos sin ninguna oferta. Funciona también con un UPDATE a mano.
-- El resumen repite `summarySql` de packages/database/src/price-summary.ts: mantenerlos iguales.

CREATE TRIGGER stores_deactivated_au AFTER UPDATE OF is_active ON stores
WHEN old.is_active = 1 AND new.is_active = 0 BEGIN
  UPDATE listings SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE store_id = new.id AND is_active = 1;

  UPDATE products SET
    (best_price, best_price_card, offer_count, in_stock_offer_count) = (
      SELECT MIN(CASE WHEN in_stock = 1 THEN price_cash END), MIN(CASE WHEN in_stock = 1 THEN price_card END),
        COUNT(DISTINCT store_id), COUNT(DISTINCT CASE WHEN in_stock = 1 THEN store_id END)
      FROM listings WHERE product_id = products.id AND is_active = 1 AND visible = 1
        AND id NOT IN (SELECT listing_id FROM match_reviews WHERE status = 'pending')),
    prices_updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id IN (SELECT product_id FROM listings WHERE store_id = new.id AND product_id IS NOT NULL);

  INSERT INTO catalog_version (id, version) VALUES (1, 1) ON CONFLICT (id) DO UPDATE SET version = version + 1;
END;
