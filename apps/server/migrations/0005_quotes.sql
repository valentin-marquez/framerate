-- Cotizaciones (armador de PC).
--
-- Modelo por "slots": cada ítem ocupa un slot del armado. En slots exclusivos
-- (cpu, motherboard, ram, gpu, psu, case, cpu_cooler) el usuario puede guardar
-- alternativas, pero sólo UNA está seleccionada (la que cuentan el total, el
-- análisis y la exportación). storage y case_fan son aditivos.

CREATE TABLE quotes (
  id               INTEGER PRIMARY KEY,
  -- Identificador corto y no adivinable para la URL (/cotizacion/:public_id).
  public_id        TEXT    NOT NULL UNIQUE CHECK (length(public_id) BETWEEN 8 AND 16),
  owner_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name             TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  description      TEXT    CHECK (description IS NULL OR length(description) <= 1000),
  -- private: sólo el dueño. unlisted: quien tenga el link. public: además aparece en su perfil.
  visibility       TEXT    NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  -- Último análisis de compatibilidad (se invalida al cambiar ítems, ver trigger).
  analysis_status  TEXT    NOT NULL DEFAULT 'unknown'
                           CHECK (analysis_status IN ('unknown', 'valid', 'warning', 'incompatible')),
  -- { estimatedWattage, issues[], performance } — ver contracts.
  analysis         TEXT    CHECK (analysis IS NULL OR json_valid(analysis)),
  analyzed_at      TEXT,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);
CREATE INDEX quotes_owner_idx ON quotes (owner_id, updated_at);

CREATE TABLE quote_items (
  id           INTEGER PRIMARY KEY,
  quote_id     INTEGER NOT NULL REFERENCES quotes (id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products (id),
  slot         TEXT    NOT NULL CHECK (slot IN (
                 'cpu', 'motherboard', 'ram', 'gpu', 'psu', 'case', 'cpu_cooler', 'storage', 'case_fan'
               )),
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  -- Oferta elegida por el usuario; NULL = "mejor precio disponible" (se resuelve al leer).
  listing_id   INTEGER REFERENCES listings (id) ON DELETE SET NULL,
  is_selected  INTEGER NOT NULL DEFAULT 1 CHECK (is_selected IN (0, 1)),
  position     INTEGER NOT NULL DEFAULT 0,
  note         TEXT    CHECK (note IS NULL OR length(note) <= 200),
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  UNIQUE (quote_id, product_id)
);
CREATE INDEX quote_items_quote_idx ON quote_items (quote_id, slot, position);
-- A lo más una alternativa seleccionada por slot exclusivo.
CREATE UNIQUE INDEX quote_items_one_selected_uq ON quote_items (quote_id, slot)
  WHERE is_selected = 1 AND slot NOT IN ('storage', 'case_fan');

-- Cualquier cambio de ítems toca la cotización e invalida el análisis guardado.
CREATE TRIGGER quote_items_touch_ai AFTER INSERT ON quote_items BEGIN
  UPDATE quotes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    analysis_status = 'unknown', analysis = NULL, analyzed_at = NULL
  WHERE id = new.quote_id;
END;
CREATE TRIGGER quote_items_touch_au AFTER UPDATE ON quote_items BEGIN
  UPDATE quotes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    analysis_status = 'unknown', analysis = NULL, analyzed_at = NULL
  WHERE id = new.quote_id;
END;
CREATE TRIGGER quote_items_touch_ad AFTER DELETE ON quote_items BEGIN
  UPDATE quotes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    analysis_status = 'unknown', analysis = NULL, analyzed_at = NULL
  WHERE id = old.quote_id;
END;
