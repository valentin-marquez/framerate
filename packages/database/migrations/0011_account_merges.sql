-- Fusión de dos usuarios (B → A) desde ajustes. `pending`: A la inició y el token viaja en la cookie
-- `framerate.merge` (se guarda sólo su hash). `done`: B ya se absorbió y se borró; se guarda quién era
-- sin FK, porque la fila de B deja de existir.
CREATE TABLE account_merges (
  id                 INTEGER PRIMARY KEY,
  survivor_id        TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash         TEXT    NOT NULL UNIQUE,
  status             TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  absorbed_id        TEXT,
  absorbed_username  TEXT,
  absorbed_email     TEXT,
  -- Qué se movió (conteos por tabla y rol de B).
  summary            TEXT    CHECK (summary IS NULL OR json_valid(summary)),
  created_at         TEXT    NOT NULL,
  expires_at         TEXT    NOT NULL,
  completed_at       TEXT,
  CHECK ((status = 'done') = (absorbed_id IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX account_merges_survivor_idx ON account_merges (survivor_id);
