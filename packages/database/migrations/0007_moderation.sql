-- Moderación: reportes de usuarios, bitácora única de acciones y feedback de traducciones.

-- Reportes de contenido. Resolver un reporte registra QUÉ se hizo (`resolution`)
-- y enlaza la acción en `moderation_actions` (el sistema anterior cerraba el
-- reporte sin actuar sobre el contenido).
CREATE TABLE reports (
  id               INTEGER PRIMARY KEY,
  target_type      TEXT    NOT NULL CHECK (target_type IN ('product', 'comment', 'store_review', 'store', 'quote', 'user')),
  target_id        TEXT    NOT NULL,
  reporter_id      TEXT    REFERENCES users (id) ON DELETE SET NULL,
  reason           TEXT    NOT NULL CHECK (reason IN (
                     'spam', 'harassment', 'misleading', 'duplicate', 'wrong_listing',
                     'broken_link', 'wrong_price', 'inappropriate', 'other'
                   )),
  details          TEXT    CHECK (details IS NULL OR length(details) <= 1000),
  status           TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  -- "Tomar" un reporte por un tiempo para que dos moderadores no trabajen el mismo.
  claimed_by       TEXT    REFERENCES users (id) ON DELETE SET NULL,
  claimed_until    TEXT,
  resolution       TEXT    CHECK (resolution IS NULL OR resolution IN (
                     'no_action', 'content_removed', 'user_banned', 'listing_fixed', 'duplicate_of_other'
                   )),
  resolution_note  TEXT    CHECK (resolution_note IS NULL OR length(resolution_note) <= 1000),
  resolved_by      TEXT    REFERENCES users (id) ON DELETE SET NULL,
  resolved_at      TEXT,
  created_at       TEXT    NOT NULL,
  CHECK ((status IN ('resolved', 'dismissed')) = (resolved_at IS NOT NULL))
);
-- Un reporte vivo por (objetivo, denunciante).
CREATE UNIQUE INDEX reports_one_live_per_reporter_uq ON reports (target_type, target_id, reporter_id)
  WHERE status IN ('open', 'reviewing');
CREATE INDEX reports_queue_idx  ON reports (status, created_at);
CREATE INDEX reports_target_idx ON reports (target_type, target_id);

-- Bitácora única (append-only) de toda acción privilegiada: moderación,
-- sanciones, roles, reclamos, fusiones de productos.
CREATE TABLE moderation_actions (
  id           INTEGER PRIMARY KEY,
  actor_id     TEXT    REFERENCES users (id) ON DELETE SET NULL,
  action       TEXT    NOT NULL CHECK (action IN (
                 'report_resolved', 'report_dismissed',
                 'comment_removed', 'comment_restored',
                 'review_removed', 'review_restored',
                 'user_banned', 'user_unbanned', 'role_changed',
                 'claim_revoked', 'store_frozen', 'store_unfrozen',
                 'product_merged', 'product_edited', 'match_reviewed'
               )),
  target_type  TEXT    NOT NULL,
  target_id    TEXT    NOT NULL,
  report_id    INTEGER REFERENCES reports (id) ON DELETE SET NULL,
  reason       TEXT,
  before       TEXT    CHECK (before IS NULL OR json_valid(before)),
  after        TEXT    CHECK (after IS NULL OR json_valid(after)),
  created_at   TEXT    NOT NULL
);
CREATE INDEX moderation_actions_target_idx ON moderation_actions (target_type, target_id, created_at);
CREATE INDEX moderation_actions_actor_idx  ON moderation_actions (actor_id, created_at);

-- Sugerencias de traducción enviadas por usuarios (anónimos incluidos).
CREATE TABLE translation_feedback (
  id               INTEGER PRIMARY KEY,
  user_id          TEXT    REFERENCES users (id) ON DELETE SET NULL,
  lang             TEXT    NOT NULL CHECK (lang IN ('es', 'en', 'arn')),
  translation_key  TEXT    NOT NULL CHECK (length(translation_key) BETWEEN 1 AND 200),
  current_text     TEXT    CHECK (current_text IS NULL OR length(current_text) <= 2000),
  suggested_text   TEXT    NOT NULL CHECK (length(suggested_text) BETWEEN 1 AND 2000),
  comment          TEXT    CHECK (comment IS NULL OR length(comment) <= 2000),
  context_path     TEXT    CHECK (context_path IS NULL OR length(context_path) <= 1000),
  status           TEXT    NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'rejected', 'duplicate')),
  reviewed_by      TEXT    REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at      TEXT,
  created_at       TEXT    NOT NULL
);
CREATE INDEX translation_feedback_queue_idx ON translation_feedback (status, lang, created_at);
