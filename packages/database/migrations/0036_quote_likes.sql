-- "Me gusta" de cotizaciones públicas (#212), como los de los comentarios (0006). El contador vive en la cotización
-- para ordenar el inicio sin agregar en cada request.
ALTER TABLE quotes ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0);

CREATE TABLE quote_likes (
  quote_id    INTEGER NOT NULL REFERENCES quotes (id) ON DELETE CASCADE,
  user_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (quote_id, user_id)
) WITHOUT ROWID;
CREATE INDEX quote_likes_user_idx ON quote_likes (user_id);

CREATE TRIGGER quote_likes_ai AFTER INSERT ON quote_likes BEGIN
  UPDATE quotes SET like_count = like_count + 1 WHERE id = new.quote_id;
END;
CREATE TRIGGER quote_likes_ad AFTER DELETE ON quote_likes BEGIN
  UPDATE quotes SET like_count = like_count - 1 WHERE id = old.quote_id;
END;

CREATE INDEX quotes_public_likes_idx ON quotes (like_count DESC) WHERE visibility = 'public';
