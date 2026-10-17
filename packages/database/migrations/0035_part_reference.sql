-- Referencia por modelo para categorías de muchas marcas (#182: coolers y gabinetes), desde las fichas de cada
-- fabricante. Una fila por modelo con sus specs ya en el formato de `listing_identity.specs`, que la normalización
-- usa para completar lo que la tienda no dice. Se reemplaza entera (`apps/normalize/scripts/part-reference.ts`).
CREATE TABLE part_reference (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  -- `brand` en minúsculas y sólo letras y números: "be quiet!" → "bequiet".
  brand_key TEXT NOT NULL,
  -- Nombre oficial sin la marca: "Peerless Assassin 120 SE", "4000D Airflow".
  model TEXT NOT NULL,
  -- JSON: las specs en el formato de `listing_identity.specs` ("sockets": "LGA1700, AM5", "max_gpu_length_mm": 360).
  specs TEXT NOT NULL,
  -- JSON: cómo escribe el catálogo este modelo.
  aliases TEXT NOT NULL DEFAULT '[]',
  source_url TEXT
);
CREATE INDEX part_reference_brand ON part_reference (category, brand_key);
