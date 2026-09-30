-- Catálogo: tiendas, productos canónicos, ofertas, precios, matching e ingesta.
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

-- Datos canónicos de la tienda (los escribe el sistema). Lo editable por el
-- dueño vive en `store_profiles` (0004).
CREATE TABLE stores (
  id                INTEGER PRIMARY KEY,
  slug              TEXT    NOT NULL UNIQUE,
  name              TEXT    NOT NULL,
  url               TEXT    NOT NULL,
  -- Dominio registrable derivado de `url` (ej. "tectec.cl"): base del reclamo por DNS.
  domain            TEXT    UNIQUE,
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  scraped_icon_url  TEXT,
  -- Reclamo: organización dueña (NULL = sin reclamar), verificación vigente y congelamiento.
  organization_id   INTEGER REFERENCES organizations (id) ON DELETE SET NULL,
  verified_at       TEXT,
  -- Se congela si la verificación DNS deja de ser válida: nadie salvo admin edita el perfil.
  frozen_at         TEXT,
  -- Contadores de reseñas mantenidos por triggers (0004): una sola fuente para el promedio.
  rating_count      INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  rating_sum        INTEGER NOT NULL DEFAULT 0 CHECK (rating_sum >= 0),
  created_at        TEXT    NOT NULL
);
CREATE INDEX stores_organization_idx ON stores (organization_id);

-- Agrupa variantes del mismo modelo (colores, OC/no-OC, capacidades) para
-- "Otras versiones". Sólo agrupa: cada variante sigue siendo su propio producto.
CREATE TABLE product_variant_groups (
  id          INTEGER PRIMARY KEY,
  category    TEXT    NOT NULL,
  name        TEXT    NOT NULL,
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
  -- Especificaciones técnicas completas, validadas contra @framerate/contracts/specs.
  specs             TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(specs)),
  specs_source      TEXT    CHECK (specs_source IS NULL OR specs_source IN ('extracted', 'opendb', 'manual')),
  specs_updated_at  TEXT,
  variant_group_id  INTEGER REFERENCES product_variant_groups (id) ON DELETE SET NULL,
  -- Imagen: URL de origen (tienda) y copia propia en R2 (lo que sirve la web).
  image_url         TEXT,
  image_key         TEXT,
  -- Resumen de precios DERIVADO de las ofertas activas (se recalcula tras cada
  -- corrida de ingesta). Permite filtrar/ordenar por precio y descuento sin agregar
  -- en cada request. Fuente de verdad: listings + product_price_daily.
  best_price           INTEGER CHECK (best_price IS NULL OR best_price > 0),
  best_price_card      INTEGER CHECK (best_price_card IS NULL OR best_price_card > 0),
  offer_count          INTEGER NOT NULL DEFAULT 0 CHECK (offer_count >= 0),
  in_stock_offer_count INTEGER NOT NULL DEFAULT 0 CHECK (in_stock_offer_count >= 0),
  -- Precio de referencia para "descuento real": máximo del mejor precio diario en 90 días.
  reference_price      INTEGER CHECK (reference_price IS NULL OR reference_price > 0),
  -- Vistas de los últimos 7 días (popularidad con ventana, recalculada a diario).
  views_7d             INTEGER NOT NULL DEFAULT 0 CHECK (views_7d >= 0),
  prices_updated_at    TEXT,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);
CREATE INDEX products_category_idx      ON products (category, best_price);
CREATE INDEX products_attribute_key_idx ON products (attribute_key);
CREATE INDEX products_brand_idx         ON products (category, brand);
CREATE INDEX products_popular_idx       ON products (category, views_7d);
CREATE INDEX products_variant_idx       ON products (variant_group_id) WHERE variant_group_id IS NOT NULL;

-- Especificaciones aplanadas para filtros (ver flattenSpecs en contracts):
-- una fila por (producto, ruta, valor). Soporta claves anidadas ("cores.total"),
-- multi-valor ("sockets") y rangos numéricos, que el sistema anterior no podía.
-- Derivada de products.specs: se reescribe completa cuando cambian las specs.
CREATE TABLE product_spec_values (
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  key         TEXT    NOT NULL,
  value_text  TEXT,
  value_num   REAL,
  CHECK ((value_text IS NULL) <> (value_num IS NULL))
);
CREATE INDEX product_spec_values_product_idx ON product_spec_values (product_id);
CREATE INDEX product_spec_values_text_idx ON product_spec_values (key, value_text, product_id) WHERE value_text IS NOT NULL;
CREATE INDEX product_spec_values_num_idx  ON product_spec_values (key, value_num, product_id)  WHERE value_num IS NOT NULL;

-- Slugs anteriores → redirect 301 (renombres o fusiones de productos).
CREATE TABLE product_slug_redirects (
  old_slug    TEXT    PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL
) WITHOUT ROWID;

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

-- Mejor precio diario por producto (una fila por día con ofertas). Base del
-- gráfico "mejor precio", del precio de referencia y de "bajas de precio".
-- No depende de qué oferta era la más barata ese día.
CREATE TABLE product_price_daily (
  product_id     INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  day            TEXT    NOT NULL CHECK (length(day) = 10),   -- YYYY-MM-DD (America/Santiago)
  min_cash       INTEGER NOT NULL CHECK (min_cash > 0),
  min_card       INTEGER NOT NULL CHECK (min_card >= min_cash),
  offer_count    INTEGER NOT NULL CHECK (offer_count > 0),
  PRIMARY KEY (product_id, day)
) WITHOUT ROWID;

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

-- ─── Analítica ──────────────────────────────────────────────────────────────

-- Vistas por producto y día (se incrementa con upsert; la web evita duplicados).
CREATE TABLE product_views_daily (
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  day         TEXT    NOT NULL CHECK (length(day) = 10),
  views       INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (product_id, day)
) WITHOUT ROWID;

-- Clics salientes hacia tiendas (base de la analítica para tiendas reclamadas).
-- Sin user agent ni URL completa: sólo lo necesario para medir.
CREATE TABLE outbound_clicks (
  id             INTEGER PRIMARY KEY,
  listing_id     INTEGER REFERENCES listings (id) ON DELETE SET NULL,
  product_id     INTEGER REFERENCES products (id) ON DELETE SET NULL,
  store_id       INTEGER NOT NULL REFERENCES stores (id),
  user_id        TEXT    REFERENCES users (id) ON DELETE SET NULL,
  source         TEXT    NOT NULL CHECK (source IN (
                   'product_hero', 'product_comparison', 'product_mobile',
                   'quote_item', 'quote_pdf', 'store_page'
                 )),
  referrer_path  TEXT    CHECK (referrer_path IS NULL OR length(referrer_path) <= 512),
  created_at     TEXT    NOT NULL
);
CREATE INDEX outbound_clicks_store_idx   ON outbound_clicks (store_id, created_at);
CREATE INDEX outbound_clicks_product_idx ON outbound_clicks (product_id, created_at);
