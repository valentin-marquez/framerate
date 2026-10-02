-- Correos a soporte@framerate.cl que entran como tickets (#69): origen 'email', tickets sin cuenta ni token (se
-- siguen por correo) y el Message-ID de cada mensaje (enlaza respuestas y evita duplicar un reintento).
--
-- SQLite no cambia un CHECK con ALTER: se recrean las dos tablas. Borrar support_tickets con su hija apuntándole
-- borraría en cascada todos los mensajes (D1 no permite apagar las foreign keys, y defer_foreign_keys no evita la
-- cascada), así que la hija nueva apunta a la tabla nueva y las viejas se borran hija primero.

PRAGMA defer_foreign_keys = true;

CREATE TABLE support_tickets_new (
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
  store_id           INTEGER REFERENCES stores (id) ON DELETE SET NULL,
  access_token_hash  TEXT    UNIQUE,
  source             TEXT    NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'api', 'system', 'email')),
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  last_message_at    TEXT    NOT NULL,
  closed_at          TEXT,
  -- Un ticket anónimo de la web necesita su token para poder seguirlo; uno que llegó por correo se sigue por correo.
  CHECK (user_id IS NOT NULL OR access_token_hash IS NOT NULL OR source = 'email')
);
INSERT INTO support_tickets_new (
  id, public_id, user_id, email, category, subject, status, assigned_to, store_id, access_token_hash, source,
  created_at, updated_at, last_message_at, closed_at
)
SELECT
  id, public_id, user_id, email, category, subject, status, assigned_to, store_id, access_token_hash, source,
  created_at, updated_at, last_message_at, closed_at
FROM support_tickets;

CREATE TABLE support_messages_new (
  id           INTEGER PRIMARY KEY,
  ticket_id    INTEGER NOT NULL REFERENCES support_tickets_new (id) ON DELETE CASCADE,
  author_id    TEXT    REFERENCES users (id) ON DELETE SET NULL,
  author_role  TEXT    NOT NULL CHECK (author_role IN ('user', 'staff', 'system')),
  body         TEXT    NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  is_internal  INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0, 1)),
  -- Message-ID del correo que trajo el mensaje o del que lo envió (respuestas del equipo).
  message_id   TEXT,
  created_at   TEXT    NOT NULL,
  CHECK (is_internal = 0 OR author_role = 'staff')
);
INSERT INTO support_messages_new (id, ticket_id, author_id, author_role, body, is_internal, created_at)
SELECT id, ticket_id, author_id, author_role, body, is_internal, created_at FROM support_messages;

DROP TABLE support_messages;
DROP TABLE support_tickets;
ALTER TABLE support_tickets_new RENAME TO support_tickets;
ALTER TABLE support_messages_new RENAME TO support_messages;

CREATE INDEX support_tickets_user_idx  ON support_tickets (user_id, last_message_at);
CREATE INDEX support_tickets_queue_idx ON support_tickets (status, last_message_at);
CREATE INDEX support_tickets_email_idx ON support_tickets (email, created_at);
CREATE INDEX support_messages_ticket_idx ON support_messages (ticket_id, created_at);
CREATE UNIQUE INDEX support_messages_message_id_uq ON support_messages (message_id) WHERE message_id IS NOT NULL;

CREATE TRIGGER support_messages_ai AFTER INSERT ON support_messages
WHEN new.is_internal = 0 BEGIN
  UPDATE support_tickets SET last_message_at = new.created_at, updated_at = new.created_at WHERE id = new.ticket_id;
END;

PRAGMA defer_foreign_keys = false;
