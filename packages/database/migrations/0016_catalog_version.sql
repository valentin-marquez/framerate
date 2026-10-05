-- Versión del catálogo público: sube cuando cambian precios u ofertas (fin de cada corrida de ingest, revisión de
-- matching aceptada). El server la mete en la clave de su caché en el edge, así que una versión nueva invalida sin purgar.
-- Una sola fila (id = 1), creada por el primer upsert.
CREATE TABLE catalog_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
);
