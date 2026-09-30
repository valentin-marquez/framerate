-- Soporte: tickets con hilo de mensajes.
--
-- El primer mensaje del usuario vive en `support_messages` como cualquier otro
-- (el sistema anterior lo duplicaba en el ticket). Los anónimos reciben un link
-- de seguimiento con token (se guarda sólo el hash).

CREATE TABLE support_tickets (
  id                 INTEGER PRIMARY KEY,
  public_id          TEXT    NOT NULL UNIQUE,
  user_id            TEXT    REFERENCES users (id) ON DELETE SET NULL,
  email              TEXT    NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  category           TEXT    NOT NULL CHECK (category IN (
                       'privacy', 'data_request', 'abuse_report', 'store_issue', 'bug', 'feature', 'other'
                     )),
  subject            TEXT    NOT NULL CHECK (length(trim(subject)) BETWEEN 3 AND 200),
  status             TEXT    NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  assigned_to        TEXT    REFERENCES users (id) ON DELETE SET NULL,
  -- Contexto opcional (ej. problema con una tienda).
  store_id           INTEGER REFERENCES stores (id) ON DELETE SET NULL,
  access_token_hash  TEXT    UNIQUE,
  source             TEXT    NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'api', 'system')),
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  last_message_at    TEXT    NOT NULL,
  closed_at          TEXT,
  -- Un ticket anónimo necesita su token para poder seguirlo.
  CHECK (user_id IS NOT NULL OR access_token_hash IS NOT NULL)
);
CREATE INDEX support_tickets_user_idx  ON support_tickets (user_id, last_message_at);
CREATE INDEX support_tickets_queue_idx ON support_tickets (status, last_message_at);

CREATE TABLE support_messages (
  id           INTEGER PRIMARY KEY,
  ticket_id    INTEGER NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
  author_id    TEXT    REFERENCES users (id) ON DELETE SET NULL,
  author_role  TEXT    NOT NULL CHECK (author_role IN ('user', 'staff', 'system')),
  body         TEXT    NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  -- Notas internas: sólo staff las escribe y sólo staff las ve (filtro en la API).
  is_internal  INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0, 1)),
  created_at   TEXT    NOT NULL,
  CHECK (is_internal = 0 OR author_role = 'staff')
);
CREATE INDEX support_messages_ticket_idx ON support_messages (ticket_id, created_at);

CREATE TRIGGER support_messages_ai AFTER INSERT ON support_messages
WHEN new.is_internal = 0 BEGIN
  UPDATE support_tickets SET last_message_at = new.created_at, updated_at = new.created_at WHERE id = new.ticket_id;
END;
