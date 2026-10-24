-- Sandos y MyShop (plataforma MyShop) mandaban "fotos/nodisponible_*.png" como foto y entró como imagen del producto
-- (11 productos, 54 ofertas el 24-10-2026). El adaptador ya la descarta; aquí se repara lo guardado: el producto toma
-- la foto de otra oferta si la hay, y pierde su copia en R2 para que se vuelva a copiar.
UPDATE products
SET image_url = (
      SELECT l.image_url FROM listings l
      WHERE l.product_id = products.id AND l.image_url IS NOT NULL AND l.image_url NOT LIKE '%/nodisponible_%'
      ORDER BY l.is_active DESC, l.in_stock DESC, l.id
      LIMIT 1
    ),
    image_key = NULL,
    image_checked_at = NULL
WHERE image_url LIKE '%/nodisponible_%';

UPDATE listings SET image_url = NULL WHERE image_url LIKE '%/nodisponible_%';
