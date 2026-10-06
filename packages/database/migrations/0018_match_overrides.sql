-- Correcciones humanas al matching que ningún crawl ni extractor nuevo deshace.
-- forbid: la oferta nunca se vincula a ese producto. force: se vincula aunque aparezca un veto.
CREATE TABLE match_overrides (
  id          INTEGER PRIMARY KEY,
  listing_id  INTEGER NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL CHECK (kind IN ('force', 'forbid')),
  created_by  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  UNIQUE (listing_id, product_id)
);
