-- Identidad: usuarios, autenticación (OAuth vía Better Auth) y sanciones.
--
-- Las tablas auth_* siguen el esquema de Better Auth (user/account/session/
-- verification) con nombres en snake_case; el mapeo de campos se configura en
-- el servidor. `users` es a la vez la cuenta y el perfil público.

CREATE TABLE users (
  id              TEXT    PRIMARY KEY,
  email           TEXT    NOT NULL UNIQUE,
  email_verified  INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  -- Handle público (/u/:username). Se genera en el servidor al registrarse
  -- (nunca se copia crudo del proveedor OAuth): minúsculas, dígitos y "_".
  username        TEXT    NOT NULL UNIQUE CHECK (
                    length(username) BETWEEN 3 AND 24
                    AND username NOT GLOB '*[^a-z0-9_]*'
                  ),
  display_name    TEXT    NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 60),
  -- Clave en R2 del avatar (se sincroniza desde el proveedor). Nunca una URL
  -- arbitraria enviada por el cliente.
  avatar_key      TEXT,
  bio             TEXT    CHECK (bio IS NULL OR length(bio) <= 280),
  lang            TEXT    NOT NULL DEFAULT 'es' CHECK (lang IN ('es', 'en', 'arn')),
  theme           TEXT    NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  -- Jerarquía estricta: un solo rol por usuario.
  role            TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL,
  -- Cuenta eliminada: se anonimizan los datos personales y se conserva la fila
  -- para no romper autoría de contenido (comentarios/reseñas quedan "[eliminado]").
  deleted_at      TEXT
);

-- Vínculo con proveedores OAuth (un usuario puede vincular varios).
CREATE TABLE auth_accounts (
  id                        TEXT PRIMARY KEY,
  user_id                   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider_id               TEXT NOT NULL,             -- "discord", "google", ...
  account_id                TEXT NOT NULL,             -- id del usuario en el proveedor
  access_token              TEXT,
  refresh_token             TEXT,
  id_token                  TEXT,
  access_token_expires_at   TEXT,
  refresh_token_expires_at  TEXT,
  scope                     TEXT,
  password                  TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  UNIQUE (provider_id, account_id)
);
CREATE INDEX auth_accounts_user_idx ON auth_accounts (user_id);

CREATE TABLE auth_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);

CREATE TABLE auth_verifications (
  id          TEXT PRIMARY KEY,
  identifier  TEXT NOT NULL,
  value       TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX auth_verifications_identifier_idx ON auth_verifications (identifier);

-- Una fila por sanción (se conserva el historial). Activa si no fue levantada
-- y no expiró. expires_at NULL = permanente.
CREATE TABLE user_bans (
  id          INTEGER PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason      TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  banned_by   TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT CHECK (expires_at IS NULL OR expires_at > created_at),
  lifted_at   TEXT,
  lifted_by   TEXT REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX user_bans_open_idx ON user_bans (user_id) WHERE lifted_at IS NULL;
