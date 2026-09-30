-- Esquema inicial de Framerate (D1 / SQLite).
--
-- Principios:
--   * Las invariantes viven en la base (UNIQUE, CHECK, FK), no sólo en el código.
--   * Una oferta (listing) es lo que vende UNA tienda; un producto es la entidad
--     canónica que agrupa ofertas equivalentes de varias tiendas.
--   * El vínculo listing → producto se decide por matching y queda auditado en
--     `match_decisions` (append-only). Deshacer un match = nueva decisión.
--   * El historial de precios sólo guarda CAMBIOS (no una fila por chequeo).
--   * Fechas en ISO-8601 UTC (TEXT), las escribe la aplicación.
--   * D1 aplica FOREIGN KEY por defecto.

CREATE TABLE stores (
  id          INTEGER PRIMARY KEY,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT    NOT NULL
);

CREATE TABLE products (
  id             INTEGER PRIMARY KEY,
  slug           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  brand          TEXT,
  category       TEXT    NOT NULL,
  -- Clave determinística derivada de atributos (ej. "gpu|asus|rtx 4070 super|12gb|dual").
  -- NULL cuando no hay atributos suficientes para construirla.
  attribute_key  TEXT,
  attributes     TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(attributes)),
  image_url      TEXT,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);
CREATE INDEX products_category_idx      ON products (category);
CREATE INDEX products_attribute_key_idx ON products (attribute_key);
CREATE INDEX products_brand_idx         ON products (category, brand);

-- Identificadores duros de un producto (MPN / GTIN normalizados).
-- La PK garantiza que un mismo identificador NO puede pertenecer a dos productos:
-- es la protección principal contra duplicados.
CREATE TABLE product_identifiers (
  kind        TEXT    NOT NULL CHECK (kind IN ('mpn', 'gtin')),
  value       TEXT    NOT NULL,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  PRIMARY KEY (kind, value)
) WITHOUT ROWID;
CREATE INDEX product_identifiers_product_idx ON product_identifiers (product_id);

CREATE TABLE listings (
  id              INTEGER PRIMARY KEY,
  store_id        INTEGER NOT NULL REFERENCES stores (id),
  -- Id estable de la oferta dentro de la tienda (id de API, SKU interno, o URL canónica).
  external_id     TEXT    NOT NULL,
  url             TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  category        TEXT    NOT NULL,
  brand           TEXT,
  mpn             TEXT,
  gtin            TEXT,
  image_url       TEXT,
  attributes      TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(attributes)),
  price_cash      INTEGER NOT NULL CHECK (price_cash > 0),
  price_card      INTEGER NOT NULL CHECK (price_card >= price_cash),
  in_stock        INTEGER NOT NULL CHECK (in_stock IN (0, 1)),
  stock_quantity  INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  -- 0 cuando la tienda dejó de publicarla (no se borra: conserva historial).
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  product_id      INTEGER REFERENCES products (id),
  first_seen_at   TEXT    NOT NULL,
  last_seen_at    TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL,
  UNIQUE (store_id, external_id)
);
CREATE INDEX listings_product_idx     ON listings (product_id);
CREATE INDEX listings_store_cat_idx   ON listings (store_id, category, last_seen_at);
CREATE INDEX listings_unmatched_idx   ON listings (product_id) WHERE product_id IS NULL;

-- Historial de precios: una fila SÓLO cuando cambia precio o disponibilidad.
CREATE TABLE price_points (
  id           INTEGER PRIMARY KEY,
  listing_id   INTEGER NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  price_cash   INTEGER NOT NULL,
  price_card   INTEGER NOT NULL,
  in_stock     INTEGER NOT NULL CHECK (in_stock IN (0, 1)),
  observed_at  TEXT    NOT NULL
);
CREATE INDEX price_points_listing_idx ON price_points (listing_id, observed_at);

-- Auditoría append-only de cada decisión de matching.
CREATE TABLE match_decisions (
  id          INTEGER PRIMARY KEY,
  listing_id  INTEGER NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products (id),
  method      TEXT    NOT NULL CHECK (method IN ('identifier', 'attributes', 'new_product', 'manual', 'unlinked')),
  confidence  REAL    NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence    TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(evidence)),
  decided_by  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);
CREATE INDEX match_decisions_listing_idx ON match_decisions (listing_id, created_at);

-- Casos dudosos que requieren revisión humana.
CREATE TABLE match_reviews (
  id                    INTEGER PRIMARY KEY,
  listing_id            INTEGER NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  candidate_product_id  INTEGER NOT NULL REFERENCES products (id),
  score                 REAL    NOT NULL,
  evidence              TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(evidence)),
  status                TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at            TEXT    NOT NULL,
  resolved_at           TEXT
);
-- Una sola revisión pendiente por listing.
CREATE UNIQUE INDEX match_reviews_pending_uq ON match_reviews (listing_id) WHERE status = 'pending';

-- Una ejecución de crawl = (tienda, categoría). Permite medir salud por tienda.
CREATE TABLE crawl_runs (
  id           TEXT    PRIMARY KEY,
  store_id     INTEGER NOT NULL REFERENCES stores (id),
  category     TEXT    NOT NULL,
  status       TEXT    NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at   TEXT    NOT NULL,
  finished_at  TEXT,
  stats        TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(stats)),
  error        TEXT
);
CREATE INDEX crawl_runs_store_idx ON crawl_runs (store_id, category, started_at);

-- Ofertas que no pasaron validación. Nunca llegan a `listings`.
CREATE TABLE quarantine (
  id           INTEGER PRIMARY KEY,
  run_id       TEXT    NOT NULL REFERENCES crawl_runs (id) ON DELETE CASCADE,
  store_id     INTEGER NOT NULL REFERENCES stores (id),
  external_id  TEXT,
  reason       TEXT    NOT NULL,
  payload      TEXT    NOT NULL CHECK (json_valid(payload)),
  created_at   TEXT    NOT NULL
);
CREATE INDEX quarantine_run_idx ON quarantine (run_id);

-- Búsqueda de texto (FTS5), sincronizada por triggers.
CREATE VIRTUAL TABLE products_fts USING fts5 (
  name,
  brand,
  content = 'products',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts (rowid, name, brand) VALUES (new.id, new.name, new.brand);
END;
CREATE TRIGGER products_fts_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts (products_fts, rowid, name, brand) VALUES ('delete', old.id, old.name, old.brand);
END;
CREATE TRIGGER products_fts_au AFTER UPDATE OF name, brand ON products BEGIN
  INSERT INTO products_fts (products_fts, rowid, name, brand) VALUES ('delete', old.id, old.name, old.brand);
  INSERT INTO products_fts (rowid, name, brand) VALUES (new.id, new.name, new.brand);
END;
