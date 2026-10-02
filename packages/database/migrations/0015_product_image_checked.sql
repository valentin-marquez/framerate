-- Último intento de ingest de copiar `image_url` a R2 (`image_key`), salga bien o mal. Sirve para no reintentar en cada
-- corrida una foto que la tienda ya no sirve: se vuelve a probar al día siguiente.
ALTER TABLE products ADD COLUMN image_checked_at TEXT;
