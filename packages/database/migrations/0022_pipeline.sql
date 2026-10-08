-- Pipeline de normalización con Haiku (spec docs/specs/2026-10-08-preprocesador-ia.md, #153). Sólo agrega: las
-- columnas nuevas tienen DEFAULT y el código anterior sigue funcionando sin tocarlas.

-- Oferta: hash de lo relevante (versión, categoría, título, códigos, marca, ficha), estado en el pipeline, ficha
-- recortada a 3.000 caracteres (permite re-anclar sin volver a la tienda), visibilidad (una oferta nueva nace oculta
-- hasta vincularse) y categoría de la corrida que la trajo (#97: `category` la fija el normalizador).
ALTER TABLE listings ADD COLUMN norm_hash TEXT;
ALTER TABLE listings ADD COLUMN norm_status TEXT NOT NULL DEFAULT 'legacy'
  CHECK (norm_status IN ('legacy', 'pending', 'normalized', 'linked', 'fallback', 'failed'));
ALTER TABLE listings ADD COLUMN norm_at TEXT;
ALTER TABLE listings ADD COLUMN source_text TEXT;
ALTER TABLE listings ADD COLUMN visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1));
ALTER TABLE listings ADD COLUMN crawl_category TEXT;
CREATE INDEX listings_norm_status_idx ON listings (norm_status);
-- El plazo de 24 h para publicar por `fallback` busca lo oculto por antigüedad.
CREATE INDEX listings_hidden_idx ON listings (first_seen_at) WHERE visible = 0;

-- Un producto se publica cuando se vincula su primera oferta visible.
ALTER TABLE products ADD COLUMN published_at TEXT;

-- La cuarentena no repite el mismo rechazo en cada corrida: una fila por (tienda, oferta, motivo, hash).
ALTER TABLE quarantine ADD COLUMN norm_hash TEXT;
CREATE UNIQUE INDEX quarantine_dedupe_idx ON quarantine (store_id, external_id, reason, norm_hash);

-- Identidad de una oferta según el normalizador: una fila por oferta y versión.
CREATE TABLE listing_identity (
  listing_id   INTEGER NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  input_hash   TEXT    NOT NULL,
  model        TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  brand        TEXT,
  name         TEXT    NOT NULL,
  mpn          TEXT,
  confidence   TEXT    NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  -- Sólo lo anclado al texto o a un decodificador de MPN; es lo único que entra a claves y vetos.
  identity     TEXT    NOT NULL CHECK (json_valid(identity)),
  -- Lo que devolvió Haiku con sus listas de procedencia, para medir cuánto inventa.
  identity_raw TEXT    NOT NULL CHECK (json_valid(identity_raw)),
  specs        TEXT    NOT NULL CHECK (json_valid(specs)),
  -- { campo: 'text' | 'knowledge' }: lo de conocimiento se muestra con nota y nunca filtra.
  specs_source TEXT    NOT NULL CHECK (json_valid(specs_source)),
  created_at   TEXT    NOT NULL,
  PRIMARY KEY (listing_id, version)
) WITHOUT ROWID;

-- Libro de gasto: una fila por llamada a un modelo, escrita antes de procesar la respuesta.
CREATE TABLE ai_usage (
  id                 INTEGER PRIMARY KEY,
  at                 TEXT    NOT NULL,
  worker             TEXT    NOT NULL CHECK (worker IN ('normalize', 'match')),
  purpose            TEXT    NOT NULL CHECK (purpose IN ('normalize', 'judge', 'extract')),
  model              TEXT    NOT NULL,
  listing_id         INTEGER,
  review_id          INTEGER,
  input_tokens       INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens      INTEGER NOT NULL DEFAULT 0,
  usd                REAL    NOT NULL DEFAULT 0,
  ms                 INTEGER,
  status             TEXT    NOT NULL CHECK (status IN ('ok', 'invalid', 'refusal', 'rate_limited', 'no_credit', 'error')),
  error              TEXT
);
CREATE INDEX ai_usage_at_idx ON ai_usage (at);

-- Fila única: pausa global del pipeline cuando no hay crédito.
CREATE TABLE pipeline_state (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  paused_until TEXT,
  updated_at   TEXT NOT NULL
);
INSERT INTO pipeline_state (id, paused_until, updated_at) VALUES (1, NULL, '2026-10-08T00:00:00.000Z');

-- Vínculo en sombra: qué haría `decide` con la identidad, contra el vínculo actual, antes de encender.
CREATE TABLE match_shadow (
  id                 INTEGER PRIMARY KEY,
  listing_id         INTEGER NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  version            INTEGER NOT NULL,
  kind               TEXT    NOT NULL CHECK (kind IN ('link', 'review', 'new_product')),
  product_id         INTEGER REFERENCES products (id) ON DELETE SET NULL,
  score              REAL    NOT NULL,
  vetoes             TEXT    NOT NULL CHECK (json_valid(vetoes)),
  current_product_id INTEGER,
  agrees             INTEGER NOT NULL CHECK (agrees IN (0, 1)),
  created_at         TEXT    NOT NULL,
  UNIQUE (listing_id, version)
);
