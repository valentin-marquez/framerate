-- La oferta tal como la publica la tienda, para la huella multicapa: el título sin limpiar (volver a
-- extraer atributos cuando mejoren los extractores) y todas sus fotos (hash perceptual, capa 4).
ALTER TABLE listings ADD COLUMN raw_title TEXT;
ALTER TABLE listings ADD COLUMN image_urls TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(image_urls));
