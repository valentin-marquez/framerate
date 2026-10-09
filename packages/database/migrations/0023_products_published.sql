-- Los productos de antes del pipeline (#153) ya están a la vista: se publican con su fecha de creación. Los que nazcan
-- después reciben `published_at` al vincularse su primera oferta (publishListing) o en el plazo de 24 h.
UPDATE products
SET published_at = created_at
WHERE published_at IS NULL
  AND EXISTS (SELECT 1 FROM listings l WHERE l.product_id = products.id AND l.visible = 1);
