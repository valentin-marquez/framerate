-- Búsqueda: forma canónica del nombre con letras y números separados cuando las dos partes tienen 2 o más
-- caracteres, para que "RTX 5070Ti" y "RTX 5070 Ti" queden con los mismos tokens y escribir el modelo pegado o
-- separado encuentre lo mismo (#129). La escribe la app (`searchText` de @framerate/kit) y el índice la lee desde
-- `products`, como el nombre y la marca. Los productos ya creados se rellenan con
-- `scripts/backfill-product-search.ts`; cada UPDATE dispara el trigger y actualiza el índice.
ALTER TABLE products ADD COLUMN search TEXT;

DROP TRIGGER products_fts_ai;
DROP TRIGGER products_fts_ad;
DROP TRIGGER products_fts_au;
DROP TABLE products_fts;

CREATE VIRTUAL TABLE products_fts USING fts5 (
  name,
  brand,
  search,
  content = 'products',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts (rowid, name, brand, search) VALUES (new.id, new.name, new.brand, new.search);
END;
CREATE TRIGGER products_fts_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts (products_fts, rowid, name, brand, search)
  VALUES ('delete', old.id, old.name, old.brand, old.search);
END;
CREATE TRIGGER products_fts_au AFTER UPDATE OF name, brand, search ON products BEGIN
  INSERT INTO products_fts (products_fts, rowid, name, brand, search)
  VALUES ('delete', old.id, old.name, old.brand, old.search);
  INSERT INTO products_fts (rowid, name, brand, search) VALUES (new.id, new.name, new.brand, new.search);
END;

INSERT INTO products_fts (products_fts) VALUES ('rebuild');
