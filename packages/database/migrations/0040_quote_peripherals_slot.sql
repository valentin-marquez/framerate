-- Slot 'peripherals' en las cotizaciones (teclados y mouses, #229). SQLite no cambia un CHECK con ALTER: se recrea
-- quote_items. Nada le apunta con foreign key, así que se borra la vieja sin cascadas. El índice único de "uno
-- seleccionado por slot" también excluye ahora a 'peripherals', que es aditivo.

CREATE TABLE quote_items_new (
  id           INTEGER PRIMARY KEY,
  quote_id     INTEGER NOT NULL REFERENCES quotes (id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products (id),
  slot         TEXT    NOT NULL CHECK (slot IN (
                 'cpu', 'motherboard', 'ram', 'gpu', 'psu', 'case', 'cpu_cooler', 'storage', 'case_fan', 'peripherals'
               )),
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  listing_id   INTEGER REFERENCES listings (id) ON DELETE SET NULL,
  is_selected  INTEGER NOT NULL DEFAULT 1 CHECK (is_selected IN (0, 1)),
  position     INTEGER NOT NULL DEFAULT 0,
  note         TEXT    CHECK (note IS NULL OR length(note) <= 200),
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  UNIQUE (quote_id, product_id)
);
INSERT INTO quote_items_new (id, quote_id, product_id, slot, quantity, listing_id, is_selected, position, note, created_at, updated_at)
SELECT id, quote_id, product_id, slot, quantity, listing_id, is_selected, position, note, created_at, updated_at FROM quote_items;

DROP TABLE quote_items;
ALTER TABLE quote_items_new RENAME TO quote_items;

CREATE INDEX quote_items_quote_idx ON quote_items (quote_id, slot, position);
CREATE UNIQUE INDEX quote_items_one_selected_uq ON quote_items (quote_id, slot)
  WHERE is_selected = 1 AND slot NOT IN ('storage', 'case_fan', 'peripherals');

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
