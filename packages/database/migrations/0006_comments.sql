-- Comentarios en productos: hilos de hasta 10 niveles, "me gusta", borrado lógico.
--
-- Formato del cuerpo: texto plano (la web renderiza bloques de código, enlaces
-- y embebe cotizaciones pegadas como URL /cotizacion/:public_id).

CREATE TABLE comments (
  id               INTEGER PRIMARY KEY,
  product_id       INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  parent_id        INTEGER REFERENCES comments (id) ON DELETE RESTRICT,
  -- Calculados por trigger al insertar:
  root_id          INTEGER,
  depth            INTEGER NOT NULL DEFAULT 0 CHECK (depth BETWEEN 0 AND 10),
  -- Ruta materializada con ids de ancho fijo ("0000000012/0000000045"):
  -- ordenar por path = orden de lectura del hilo.
  path             TEXT    NOT NULL DEFAULT '',
  author_id        TEXT    REFERENCES users (id) ON DELETE SET NULL,
  -- NULL sólo cuando está eliminado (el texto se borra, la estructura del hilo queda).
  body             TEXT    CHECK (body IS NULL OR length(body) BETWEEN 1 AND 5000),
  like_count       INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  -- Sólo en raíces: respuestas NO eliminadas en todo el hilo.
  reply_count      INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  edited_at        TEXT,
  deleted_at       TEXT,
  deleted_by       TEXT    REFERENCES users (id) ON DELETE SET NULL,
  deletion_reason  TEXT    CHECK (deletion_reason IS NULL OR deletion_reason IN ('author', 'moderation')),
  created_at       TEXT    NOT NULL,
  CHECK ((deleted_at IS NULL) = (deletion_reason IS NULL)),
  CHECK (deleted_at IS NOT NULL OR body IS NOT NULL)
);
-- Raíces de un producto (listado principal) y árbol de un hilo.
CREATE INDEX comments_roots_idx  ON comments (product_id, created_at) WHERE parent_id IS NULL;
CREATE INDEX comments_best_idx   ON comments (product_id, like_count, created_at) WHERE parent_id IS NULL;
CREATE INDEX comments_thread_idx ON comments (root_id, path);
CREATE INDEX comments_author_idx ON comments (author_id);

CREATE TRIGGER comments_tree_ai AFTER INSERT ON comments BEGIN
  UPDATE comments SET
    root_id = COALESCE((SELECT p.root_id FROM comments p WHERE p.id = new.parent_id), new.id),
    depth   = COALESCE((SELECT p.depth + 1 FROM comments p WHERE p.id = new.parent_id), 0),
    path    = COALESCE((SELECT p.path || '/' FROM comments p WHERE p.id = new.parent_id), '')
              || printf('%010d', new.id)
  WHERE id = new.id;
  -- La respuesta debe pertenecer al mismo producto que su padre.
  SELECT RAISE(ABORT, 'parent_product_mismatch')
  WHERE new.parent_id IS NOT NULL
    AND (SELECT p.product_id FROM comments p WHERE p.id = new.parent_id) <> new.product_id;
  UPDATE comments SET reply_count = reply_count + 1
  WHERE new.parent_id IS NOT NULL
    AND id = (SELECT p.root_id FROM comments p WHERE p.id = new.parent_id);
END;

CREATE TRIGGER comments_soft_delete_au AFTER UPDATE OF deleted_at ON comments
WHEN new.parent_id IS NOT NULL AND (old.deleted_at IS NULL) <> (new.deleted_at IS NULL) BEGIN
  UPDATE comments SET reply_count = reply_count + (CASE WHEN new.deleted_at IS NULL THEN 1 ELSE -1 END)
  WHERE id = new.root_id;
END;

-- La web sólo usa "me gusta" (no votos negativos).
CREATE TABLE comment_likes (
  comment_id  INTEGER NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  user_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (comment_id, user_id)
) WITHOUT ROWID;
CREATE INDEX comment_likes_user_idx ON comment_likes (user_id);

CREATE TRIGGER comment_likes_ai AFTER INSERT ON comment_likes BEGIN
  UPDATE comments SET like_count = like_count + 1 WHERE id = new.comment_id;
END;
CREATE TRIGGER comment_likes_ad AFTER DELETE ON comment_likes BEGIN
  UPDATE comments SET like_count = like_count - 1 WHERE id = old.comment_id;
END;
