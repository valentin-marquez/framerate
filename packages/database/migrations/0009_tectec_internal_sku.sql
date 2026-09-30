-- TecTec se integró con sku "mpn", pero su SKU es un código interno ("0307002A03N-2"). Esos valores
-- quedaron como MPN de productos y ofertas: como identificador falso, además, marcaban conflicto de MPN
-- con el MPN real de otra tienda y bloqueaban la fusión. Se borran, salvo que otra tienda publique el mismo.
DELETE FROM product_identifiers
WHERE kind = 'mpn'
  AND value IN (
    SELECT l.mpn FROM listings l JOIN stores s ON s.id = l.store_id
    WHERE s.slug = 'tectec' AND l.mpn IS NOT NULL
  )
  AND value NOT IN (
    SELECT l.mpn FROM listings l JOIN stores s ON s.id = l.store_id
    WHERE s.slug <> 'tectec' AND l.mpn IS NOT NULL
  );

UPDATE listings SET mpn = NULL
WHERE mpn IS NOT NULL AND store_id IN (SELECT id FROM stores WHERE slug = 'tectec');
