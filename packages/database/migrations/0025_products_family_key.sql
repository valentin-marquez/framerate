-- Familia de un producto (#101): la clave del modelo sin lo que distingue una variante (color, RGB, V2, pantalla).
-- La calcula `familyKey` en @framerate/matching al crear o completar la huella; el relleno de lo existente va aparte
-- (`packages/database/scripts/backfill-family-key.ts`), porque sale de `attributes`.
ALTER TABLE products ADD COLUMN family_key TEXT;
CREATE INDEX products_family_key ON products (family_key) WHERE family_key IS NOT NULL;
