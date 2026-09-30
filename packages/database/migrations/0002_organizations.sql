-- Organizaciones: la empresa dueña de una o más tiendas reclamadas.
--
-- Roles (aplican a todas las tiendas de la organización):
--   owner  → todo, incluido administrar owners. Debe existir al menos uno (regla en la API).
--   admin  → administra tiendas y miembros (no puede otorgar/quitar owner).
--   editor → edita perfil de tienda y responde reseñas.

CREATE TABLE organizations (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE organization_members (
  organization_id  INTEGER NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id          TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role             TEXT    NOT NULL CHECK (role IN ('owner', 'admin', 'editor')),
  invited_by       TEXT    REFERENCES users (id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL,
  PRIMARY KEY (organization_id, user_id)
) WITHOUT ROWID;
CREATE INDEX organization_members_user_idx ON organization_members (user_id);

-- Invitaciones por email con token de un solo uso (se guarda sólo el hash).
-- Reemplaza "agregar miembro pegando un UUID".
CREATE TABLE organization_invitations (
  id               INTEGER PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  email            TEXT    NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  role             TEXT    NOT NULL CHECK (role IN ('admin', 'editor')),
  token_hash       TEXT    NOT NULL UNIQUE,
  invited_by       TEXT    REFERENCES users (id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL,
  expires_at       TEXT    NOT NULL,
  accepted_at      TEXT,
  accepted_by      TEXT    REFERENCES users (id) ON DELETE SET NULL,
  revoked_at       TEXT
);
CREATE UNIQUE INDEX organization_invitations_pending_uq
  ON organization_invitations (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
