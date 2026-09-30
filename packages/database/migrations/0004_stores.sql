-- Tiendas como comunidad: perfil editable por el dueño, reclamo por DNS y reseñas.

-- Capa editable por la organización dueña (1:1 con stores). Si no hay fila,
-- la web muestra los datos canónicos de `stores`.
CREATE TABLE store_profiles (
  store_id      INTEGER PRIMARY KEY REFERENCES stores (id) ON DELETE CASCADE,
  display_name  TEXT CHECK (display_name IS NULL OR length(trim(display_name)) BETWEEN 1 AND 120),
  description   TEXT CHECK (description IS NULL OR length(description) <= 500),
  website_url   TEXT CHECK (website_url IS NULL OR website_url LIKE 'https://%' OR website_url LIKE 'http://%'),
  -- Redes sociales con claves permitidas (validadas en la API):
  -- {"instagram": "...", "x": "...", "facebook": "...", "tiktok": "...", "youtube": "..."}
  social        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(social)),
  icon_key      TEXT,   -- R2
  banner_key    TEXT,   -- R2
  updated_by    TEXT REFERENCES users (id) ON DELETE SET NULL,
  updated_at    TEXT NOT NULL
);

-- Reclamo de una tienda probando control del dominio con un registro TXT:
--   _framerate-verify.<domain>  TXT  "framerate-verify=v1:<token>"
--
-- Ciclo de vida:
--   pending → verified (TXT encontrado) → confirmed (se crea/asigna organización)
--   pending/verified → expired (vence sin completar)
--   confirmed → stale (el TXT desapareció en re-chequeos) → confirmed (reaparece)
--   cualquier estado → revoked (admin)
CREATE TABLE store_claims (
  id                    INTEGER PRIMARY KEY,
  store_id              INTEGER NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  claimant_id           TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  domain                TEXT    NOT NULL,
  token                 TEXT    NOT NULL UNIQUE,
  status                TEXT    NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'verified', 'confirmed', 'expired', 'stale', 'revoked')),
  attempts              INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at       TEXT,
  -- Fallas seguidas en re-chequeos de un reclamo confirmado (3 → stale + congelar tienda).
  consecutive_failures  INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_checked_at       TEXT,
  last_error            TEXT,
  dns_provider          TEXT,   -- sólo UX (instrucciones por proveedor)
  verified_at           TEXT,
  confirmed_at          TEXT,
  expires_at            TEXT    NOT NULL,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);
-- Un solo reclamo en curso o vigente por tienda: impide que un segundo usuario
-- "se sume" como dueño de una tienda ya reclamada (bug del sistema anterior).
CREATE UNIQUE INDEX store_claims_live_uq ON store_claims (store_id)
  WHERE status IN ('pending', 'verified', 'confirmed', 'stale');
CREATE INDEX store_claims_claimant_idx ON store_claims (claimant_id);
CREATE INDEX store_claims_recheck_idx ON store_claims (status, last_checked_at)
  WHERE status IN ('confirmed', 'stale');

-- Auditoría append-only del ciclo de vida de reclamos.
CREATE TABLE store_claim_events (
  id          INTEGER PRIMARY KEY,
  claim_id    INTEGER NOT NULL REFERENCES store_claims (id) ON DELETE CASCADE,
  store_id    INTEGER NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  action      TEXT    NOT NULL CHECK (action IN (
                'created', 'verified', 'confirmed', 'expired',
                'recheck_ok', 'recheck_failed', 'stale', 'unfrozen', 'revoked'
              )),
  actor_id    TEXT    REFERENCES users (id) ON DELETE SET NULL,
  reason      TEXT,
  metadata    TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at  TEXT    NOT NULL
);
CREATE INDEX store_claim_events_claim_idx ON store_claim_events (claim_id, created_at);

-- Reseñas de tiendas (1–5 estrellas). Una reseña activa por usuario y tienda.
CREATE TABLE store_reviews (
  id                 INTEGER PRIMARY KEY,
  store_id           INTEGER NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  user_id            TEXT    REFERENCES users (id) ON DELETE SET NULL,
  rating             INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body               TEXT    CHECK (body IS NULL OR length(body) <= 2000),
  helpful_count      INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  is_pinned          INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  owner_response     TEXT    CHECK (owner_response IS NULL OR length(owner_response) <= 1000),
  owner_response_at  TEXT,
  owner_response_by  TEXT    REFERENCES users (id) ON DELETE SET NULL,
  edited_at          TEXT,
  deleted_at         TEXT,
  deleted_by         TEXT    REFERENCES users (id) ON DELETE SET NULL,
  deletion_reason    TEXT    CHECK (deletion_reason IS NULL OR deletion_reason IN ('author', 'moderation')),
  created_at         TEXT    NOT NULL,
  CHECK ((deleted_at IS NULL) = (deletion_reason IS NULL)),
  CHECK ((owner_response IS NULL) = (owner_response_at IS NULL))
);
CREATE UNIQUE INDEX store_reviews_one_per_user_uq ON store_reviews (store_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX store_reviews_list_idx ON store_reviews (store_id, deleted_at, is_pinned, created_at);

CREATE TABLE store_review_votes (
  review_id   INTEGER NOT NULL REFERENCES store_reviews (id) ON DELETE CASCADE,
  user_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (review_id, user_id)
) WITHOUT ROWID;
CREATE INDEX store_review_votes_user_idx ON store_review_votes (user_id);

-- ─── Contadores derivados (triggers) ────────────────────────────────────────
-- Una reseña cuenta para el promedio sólo si no está eliminada.

CREATE TRIGGER store_reviews_rating_ai AFTER INSERT ON store_reviews
WHEN new.deleted_at IS NULL BEGIN
  UPDATE stores SET rating_count = rating_count + 1, rating_sum = rating_sum + new.rating WHERE id = new.store_id;
END;

CREATE TRIGGER store_reviews_rating_au AFTER UPDATE OF rating, deleted_at ON store_reviews BEGIN
  UPDATE stores SET
    rating_count = rating_count
      - (CASE WHEN old.deleted_at IS NULL THEN 1 ELSE 0 END)
      + (CASE WHEN new.deleted_at IS NULL THEN 1 ELSE 0 END),
    rating_sum = rating_sum
      - (CASE WHEN old.deleted_at IS NULL THEN old.rating ELSE 0 END)
      + (CASE WHEN new.deleted_at IS NULL THEN new.rating ELSE 0 END)
  WHERE id = new.store_id;
END;

CREATE TRIGGER store_reviews_rating_ad AFTER DELETE ON store_reviews
WHEN old.deleted_at IS NULL BEGIN
  UPDATE stores SET rating_count = rating_count - 1, rating_sum = rating_sum - old.rating WHERE id = old.store_id;
END;

CREATE TRIGGER store_review_votes_ai AFTER INSERT ON store_review_votes BEGIN
  UPDATE store_reviews SET helpful_count = helpful_count + 1 WHERE id = new.review_id;
END;

CREATE TRIGGER store_review_votes_ad AFTER DELETE ON store_review_votes BEGIN
  UPDATE store_reviews SET helpful_count = helpful_count - 1 WHERE id = old.review_id;
END;
